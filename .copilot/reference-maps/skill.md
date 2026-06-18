---
name: keystone-part-reference
version: 0.1.0
description: >
  Resolve relationships between MPN, MSPN, Supplier,
  Commodity, and Subcategory using Keystone reference data.
  Supports lookups starting from any known attribute and
  returns matching related attributes.
triggers:
  - intent: "User wants to map or translate between MPN, MSPN, Supplier, Commodity, and Subcategory."
  - intent: "User wants to identify related part metadata."
  - intent: "User wants to find relationships among Keystone product reference attributes."
  - examples:
      - "What subcategory is this MPN?"
      - "Which supplier owns this MSPN?"
      - "Show all MPNs in COMPONENT_DRAM."
      - "What commodity does this supplier provide?"
      - "Map supplier to subcategory."
inputs:
  - name: mpns
    type: list[string]
    required: false
    description: "List of MPNs to look up."
  - name: mspns
    type: list[string]
    required: false
    description: "List of MSPNs to look up."
  - name: suppliers
    type: list[string]
    required: false
    description: "List of suppliers to filter by."
  - name: commodities
    type: list[string]
    required: false
    description: "List of commodities to filter by."
  - name: subcategories
    type: list[string]
    required: false
    description: "List of subcategories to filter by."
  - name: row_limit
    type: integer
    required: false
    description: "Maximum number of rows to return (honors limits.default_row_limit and limits.max_row_limit)."
outputs:
  - name: rows
    type: table
    columns:
      - Subcategory
      - MPN
      - MSPN
      - Supplier
      - Commodity
permissions:
  - database: read
env:
  - name: KEYSTONE_DB_HOST
    default: "arches.database.windows.net"
  - name: KEYSTONE_DB_NAME
    default: "Keystone"
  - name: KEYSTONE_DB_USER
  - name: KEYSTONE_DB_PASS
  - name: KEYSTONE_DB_DRIVER
    default: "ODBC"  # or appropriate driver

auth:
  preferred_flows:
    - name: ActiveDirectoryInteractive
      description: "Azure AD (Microsoft Entra) interactive authentication with MFA for human users. Use drivers that support ActiveDirectoryInteractive (ODBC/ODBC Driver 18+ / pyodbc)."
    - name: ManagedIdentity
      description: "Use Managed Identity when running in Azure (recommended for automation and CI)."
    - name: AzureCLI-token
      description: "Obtain an access token via 'az login' (interactive) or service principal, then pass the token to the DB driver (resource: https://database.windows.net)."
  note: "DO NOT store plaintext DB credentials in source control. Use a secret manager or Azure Key Vault. For interactive testing, prefer ActiveDirectoryInteractive (MFA). For automation, use Managed Identity or an Azure AD service principal with appropriately scoped credentials."
  examples: |
    - Python (pyodbc) interactive/MFA connection string example:
        conn_str = (
          "Driver={ODBC Driver 18 for SQL Server};"
          "Server=tcp:arches.database.windows.net,1433;"
          "Database=Keystone;"
          "Authentication=ActiveDirectoryInteractive;"
        )
    - Token approach (non-interactive):
        az account get-access-token --resource https://database.windows.net --query accessToken -o tsv
        # Pass the returned token to your DB driver according to the driver's access-token API.
query_template: |
  -- Base query (normalization and row limit)
  SELECT DISTINCT TOP ({row_limit})
    UPPER(REPLACE(LOWER(partsubcategory),'component dram','component_dram')) AS Subcategory,
    mpn AS MPN,
    mspn AS MSPN,
    partcategory AS Commodity,
    suppliername AS Supplier
  FROM vwplanning.sapibpreferencetdst2aproduct
  WHERE mpn IS NOT NULL
    AND mpn <> '<Null>'
    AND partsubcategory IS NOT NULL
    AND partsubcategory <> '<Null>'
    AND _keystone_recordenddate >= GETDATE()
    {parameter_filters}

filter_policy:
  parameterized_only: true
  no_string_concatenation: true

default_behavior:
  when_no_filters: "Return only a 20 row sample unless user explicitly asks for full export."

limits:
  default_row_limit: 500
  max_row_limit: 10000

freshness_rule:
  active_records_only: "_keystone_recordenddate >= GETDATE()"

matching_rules:
  mpn:
    case_sensitive: false
    trim_whitespace: true
    normalize_dashes_spaces: true
    preserve_original_output: true

usage_notes: |
  - The skill requires parameterized queries only. Do NOT construct SQL by concatenating user input into strings.
  - Replace {parameter_filters} with parameterized WHERE clauses derived from inputs:
      * For mpns: AND mpn IN (@mpn_list)  -- pass mpn_list as a parameterized array or table-valued parameter
      * For mspns: AND mspn IN (@mspn_list)
      * For subcategory: AND UPPER(REPLACE(LOWER(partsubcategory),'component dram','component_dram')) = @subcategory
  - Row limits: honor {row_limit} and enforce server-side limits. Default when unspecified: {default_row_limit}.
  - For very large MPN lists, use a temp table or table-valued parameter and JOIN instead of IN(...)
  - Use a read-only DB account and store KEYSTONE_DB_USER/PASS in secret store (do NOT commit credentials).
power_query_reference: |
  Sql.Database(
      "arches.database.windows.net",
      "Keystone",
      [
          Query = "
      SELECT DISTINCT
          UPPER(
              REPLACE(
                  LOWER(partsubcategory),
                  'component dram',
                  'component_dram'
              )
          ) AS Subcategory,
          mpn AS MPN,
          mspn AS MSPN,
          partcategory AS Commodity,
          suppliername AS Supplier
      FROM vwplanning.sapibpreferencetdst2aproduct
      WHERE mpn <> '<Null>' 
        AND partsubcategory <> '<Null>'
        AND _keystone_recordenddate >= getdate();
  "
      ]
  )
examples:
  - input:
      mpns: ["PN123","PN456"]
    output_preview:
      rows:
        - Subcategory: "MEMORY_MODULE"
          MPN: "PN123"
          MSPN: "MSP-0001"
          Supplier: "Vendor A"
          Commodity: "Memory"
  - input:
      subcategory: "COMPONENT_DRAM"
    output_preview:
      rows:
        - Subcategory: "COMPONENT_DRAM"
          MPN: "DRAM-XYZ"
          MSPN: "MSP-DRAM1"
          Supplier: "Vendor B"
          Commodity: "Memory"
tests: |
  - scenario: single-mpn-lookup
    steps:
      - call: keystone-reference-map
        input: { mpns: ["PN123"] }
        expect:
          rows_count_min: 1
          columns_present: ["Subcategory","MPN","MSPN","Supplier","Commodity"]
cache:
  enabled: true
  ttl_hours: 24
notes: |
  - Recommended: materialize a nightly snapshot (lookup table) to improve performance and avoid live-querying on heavy workloads.
  - For natural-language mapping, map user phrases to inputs:
      * "show me the subcategory for these MPNs" -> set mpns
      * "What's the MSPN for this MPN" -> set mpns (return MSPN column)
      * "connect the MPN to the subcategory" -> return full rows table
  - Ensure rate limiting and batching when users pass many MPNs.
---

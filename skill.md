---
name: keystone-reference-map
version: 0.1.0
description: "Reference map that links MPN ↔ MSPN ↔ Subcategory ↔ Supplier ↔ Commodity using Keystone vwplanning.sapibpreferencetdst2aproduct."
triggers:
  - phrase: "connect the MPN to the subcategory"
  - phrase: "show me the subcategory for these MPNs"
  - phrase: "what's the MSPN for this MPN"
  - phrase: "mpn reference"
  - phrase: "mpn to subcategory"
inputs:
  - name: mpns
    type: list[string]
    required: false
    description: "List of MPNs to look up. If omitted, the skill can return a sample or the cached reference table."
  - name: mspns
    type: list[string]
    required: false
    description: "Optional list of MSPNs to filter."
  - name: subcategory
    type: string
    required: false
    description: "Optional subcategory filter."
  - name: supplier
    type: string
    required: false
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
query_template: |
  -- Base query (follow Power Query normalization)
  SELECT DISTINCT
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
    {extra_filters}
usage_notes: |
  - Replace {extra_filters} with parameterized filters derived from inputs:
      * For mpns: AND mpn IN ('PN1','PN2',...)
      * For mspns: AND mspn IN (...)
      * For subcategory: AND UPPER(REPLACE(LOWER(partsubcategory),'component dram','component_dram')) = 'COMPONENT_DRAM'
  - For very large MPN lists, upload to a temp table and JOIN instead of IN(...)
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

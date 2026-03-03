# Diagram 3: Complete Cleanup Guide with Line Numbers

Comprehensive view of `explorer-app.js` showing what to KEEP vs REMOVE, with approximate line numbers.

```mermaid
flowchart LR
    subgraph KEEP["KEEP - Core Active Code"]
        K1["constructor L12-97"]
        K2["init L99-135"]
        K3["renderPicoPins L177-211"]
        K4["loadFromMicroPython L2804-2905"]
        K5["buildFunctionalGroupsFromParser L2942-3005"]
        K6["renderMicroPythonComponents L3011-3050"]
        K7["renderMicroPythonWires L3109-3151"]
        K8["renderMicroPythonWireBundle L3159-3229"]
        K9["setupMicroPythonUI L2737-2797"]
        K10["clearCircuit L3234-3267"]
    end

    subgraph KEEP2["KEEP - Interactions"]
        I1["enableGroupInteraction L2221-2229"]
        I2["handleGroupClick L2235-2245"]
        I3["toggleGroupHighlight L2250-2270"]
        I4["activateGroup L2275-2303"]
        I5["deactivateGroup L2308-2335"]
        I6["showGroupInfo L1371-1406"]
        I7["buildSignalPaths L1416-1478"]
        I8["enableWireInteraction L980-987"]
        I9["handleWireHover L1008-1026"]
        I10["showTooltip L1519-1577"]
    end

    subgraph REMOVE["REMOVE - Legacy JSON Flow"]
        R1["loadCircuit L344-391"]
        R2["categorizeWires L538-557"]
        R3["buildWireComponentMappings L397-441"]
        R4["detectFunctionalGroups L609-718"]
        R5["calculateGroupPositions L1826-1880"]
        R6["positionGroupRow L1885-1925"]
        R7["getGroupComponentBounds L1932-1976"]
        R8["renderGroupBoundaries L1981-2026"]
        R9["renderBundledWires L2041-2061"]
        R10["classifyGroupWires L2066-2130"]
        R11["renderGroupWireBundle L2135-2216"]
    end

    subgraph REMOVE2["REMOVE - Unused Rendering"]
        X1["renderHoles L154-175"]
        X2["createWire L218-240"]
        X3["renderWire L245-269"]
        X4["renderWireLabels L812-876"]
        X5["applyWireCategories L774-790"]
        X6["updateWireVisibility L792-808"]
        X7["setupFilterListeners L1673-1697"]
    end

    subgraph REMOVE3["REMOVE - Compatibility Stubs"]
        S1["isHoleAvailable L3355-3358"]
        S2["markHoleOccupied L3363-3367"]
        S3["clearHoleOccupation L3372-3374"]
        S4["suggestAlternativeHoles L3379-3381"]
        S5["highlightAlternativeHoles L3386-3388"]
        S6["clearAlternativeHighlights L3393-3395"]
    end

    subgraph MAYBE["MAYBE REMOVE - Redundant"]
        M1["renderAbstractComponents L2418-2488"]
        M2["renderComponentAtPosition L2496-2547"]
        M3["renderGroupBoundariesAbstract L2552-2616"]
        M4["renderBundledWiresAbstract L2622-2650"]
        M5["renderGroupWireBundleAbstract L2655-2730"]
    end
```

## Edit Link
[Open in Mermaid Live Editor](https://mermaid.ai/live/edit?utm_source=mermaid_mcp_server&utm_medium=remote_server&utm_campaign=claude#pako:eNqNVu9vo0YQ_VeQvyOxP2DZfnOipHHPbizcu7pq-mENG7w6wlqw5JSe-r93BoPNokR3lhIj-b2dmTdvZvm-yG2hF78sniv7LT-qxgXr7KkO4NN2h7JRp2Pw6e5u-_fTAr-CMLi1jQ6WuTOvGp4L_bT454zHzycCwNzWrWu63NkmWBMaSuFjKGBMbSCSlCFhsf8rg18bXRe62Zrcbk3dwiFChJQQH8gBWFlV3Df2ZWPyxm7f3NHWwZqmEQ-pjGYHx4A_dKYq7rsa0re1qn5tbHdq8YCtaloN6VLJaciiOTe5JDWJdGtfTrbWtYMMWUQI8OLI54n3eH-aRiOFRDJkJJ6VlX5EuenqotLIi4FHqfR5Enitdt1pQvu8gooEA_HEvAkkwk5VWjW3psk77AajjMPByRUJaZwf3nEEvVpiVTvdqF7T1ouyQjvoWh0q3Us9AUJilJKQzutY4blHhaX2lNvK5F8RzGIAc78vKzSLs2U5gB9MeazgzyEhjoAg_Ias0DSYwKtyZwoiBRzNIuYj0S6FnmNZlAJ25tkV2qM92m9Dkc8WLMsECQmPEh8pRhPuTAkG3Cp3RH9zkgBYpD44vaiH_ffEk2kUytTv6UpepEP8g31FR5MIUiYRnSXS9x9z_sPayhmoDZwI4xiLH7c_u9s8frkD_vkBHLDWpcrfgt92j78H97BJvFgZGSb16jQORpO-8TNsfA5Sl7Yx_-phSGKWhnHs15mxUUQEXaZwo04nU5c4WVKEnM-O530_nc7dfP6DdQKTKIivfhb3-VR5V43939rW9CYHsVIKHUtT314ZGuE0oHpKZr8hOI1DIqnvmgy9UGp3tvlYxY2FMccAklHgCL9t2XU79LQerRqje0YK8zRvdCYvjPMCKQZlacQRnsxkGvaCalvz_NbHuOCTBJYwm1VMiJ_RdFMBGoeWJD_pKDq11Oe6a3URZP3R0Fcv7P4a9cFWffUxD4nwFd73lmo09A_TwoRgerlfwf564QwgDkkn_lbacw-0VgddQdAUbrd01qI9-gasWL317hwMjSkKwUMhZ9HRMd2pGFL8YlpzMJVxbwCXcHjkm3Ivxi1_bypYB2vTOl3rBgVIBAtJIn92fNlUbLSfcmPonesO_iLfod6mRa2Xr8pUuJNgzlgch_DPz3GHqr-o5iuiH_O8OxnoI4ATBuDEn-UdG6-hC1qdNxxjAm5iJriPx0a0XVnq1i1RgVrhm8hgAoDD1chS39M77MhxvBreY6UJsmZlJGNmU8Z4Sk-TWJCMfyj4ZvnXDa7L_ju4iJ7pAqe3dl7czdXaywO8R8HGn75oUN57eJbshl5IF_DSjfsKWRKGN-a--Bv20TYZIwMzjimMA_FNvuHvbpUJLaFIm70PbeKPlsWUCaaCl5ZoKuviv_8BEK0hqg)

## Summary: Estimated Line Reduction

| Category | Lines | Description |
|----------|-------|-------------|
| **REMOVE - Legacy JSON Flow** | ~400 | `loadCircuit`, `categorizeWires`, `detectFunctionalGroups`, physical layout methods |
| **REMOVE - Unused Wire Rendering** | ~150 | `renderHoles`, `createWire`, `renderWire`, `renderWireLabels`, filter methods |
| **REMOVE - Compatibility Stubs** | ~40 | `isHoleAvailable`, `markHoleOccupied`, etc. (L3355-3395) |
| **MAYBE REMOVE - Redundant** | ~300 | Abstract methods duplicated by MicroPython-specific versions |
| **Total Removable** | **~890 lines** | ~32% of the 2800-line file |

The file could potentially be reduced from **~2800 lines to ~1900 lines** by removing the legacy guided wiring code.

## Created
December 18, 2025

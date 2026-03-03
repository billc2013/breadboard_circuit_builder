# Diagram 1: Active MicroPython Flow (KEEP)

This shows the code paths that ARE actively used when parsing MicroPython code in `explorer-app.js`.

```mermaid
flowchart TB
    subgraph Init["Initialization"]
        A1["constructor"]
        A2["init"]
        A3["loadComponentMetadata"]
        A4["setupMicroPythonUI"]
        A5["renderPicoPins"]
    end

    subgraph Parse["MicroPython Parsing"]
        B1["loadFromMicroPython"]
        B2["buildFunctionalGroupsFromParser"]
    end

    subgraph Layout["Abstract Layout"]
        C1["abstractLayout.calculateSlots"]
        C2["renderGroupBoundariesAbstract"]
    end

    subgraph Render["Rendering"]
        D1["renderMicroPythonComponents"]
        D2["renderComponentAtPositionDirect"]
        D3["renderMicroPythonWires"]
        D4["renderMicroPythonWireBundle"]
    end

    subgraph Interact["Interactions"]
        E1["enableGroupInteraction"]
        E2["handleGroupClick"]
        E3["toggleGroupHighlight"]
        E4["showTooltip"]
        E5["showGroupInfo"]
    end

    A1 --> A2
    A2 --> A3
    A2 --> A4
    A2 --> A5

    A4 --> B1
    B1 --> B2
    B2 --> C1
    C1 --> C2
    C2 --> D1
    D1 --> D2
    D1 --> D3
    D3 --> D4

    D4 --> E1
    E1 --> E2
    E2 --> E3
    E3 --> E4
    E3 --> E5
```

## Edit Link
[Open in Mermaid Live Editor](https://mermaid.ai/live/edit?utm_source=mermaid_mcp_server&utm_medium=remote_server&utm_campaign=claude#pako:eNqFU01r3DAQ_SuL7wl413vpobC2lHahAdOm9NDtQSsrtoiiMfogpKX_vfqq61ka1mCsmffmzbyx_aviMIjqXfWo4IVPzLjNQ3vSm3BZfx4Nm6fNUUv3_VTFh2RK_mROgj5VPzItXoc64By0dcZzBwaD2wDKUIyzu5BVwIYOnmfQQrt74djAHMO0JtCscH6-l9xA_-om0F-PmLMPHCP0IEwvOfRS2wUP2Xy48NQzY0UoW6mmnNQj0m7rMuadgecVGZOiw7OXarjzmsftMPXBgJ9trEqtzNWJPrFX8HHPh3NYI-OuZFCnLo7DCiHjt5wp7hVz4osCZzF9u2wmzdOC1wMzUti_Ta6O9TlVB5l8uNwPqZcOq-0s7xSPQ_6NszAOrgcr486INIJju2T3P_VvgXgh3LzFa4NhJa66PGon4jrSZ56PYSLchEarQrOzEmmZKyLmRZcTi30Tr1OSP2FGtOVgHAvjoxwnFW5snqZPf4KXBwDl5IzBfQHLKI_wlsdDvbm5eR_-whJuc7jDYYPDPVJoUrKtc9hmwbYItrmkK2iX0a6gXUZJQUlGyRaHZRiyy2Gz7k5yd1oUaC6hRYFmfVoUaFagDQ731e8_tD11AQ)

## Created
December 18, 2025

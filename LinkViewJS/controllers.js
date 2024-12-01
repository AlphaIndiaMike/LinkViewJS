// controllers.js

// Controller configurations with memory budgets, origins, and groupings
const controllerConfigurations = [
    {
        name: "STM32F411",
        memories: {
            RAM: [
                {
                    memory_type: "RAM",
                    name: "RAM1",
                    origin: 0x20000000,
                    length: 0x20000, // 128KB
                    attributes: "xrw"
                }
            ],
            FLASH: [
                {
                    memory_type: "FLASH",
                    name: "FLASH1",
                    origin: 0x08000000,
                    length: 0x80000, // 512KB
                    attributes: "rx"
                }
            ]
        }
    },
    {
        name: "STM32H7",
        memories: {
            RAM: [
                {
                    memory_type: "RAM",
                    name: "RAM1",
                    origin: 0x30000000,
                    length: 0x40000, // 256KB
                    attributes: "xrw"
                },
                {
                    memory_type: "RAM",
                    name: "RAM2",
                    origin: 0x38000000,
                    length: 0x80000, // 512KB
                    attributes: "xrw"
                },
                {
                    memory_type: "RAM",
                    name: "RAM3",
                    origin: 0x39000000,
                    length: 0x100000, // 1MB
                    attributes: "xrw"
                }
            ],
            FLASH: [
                {
                    memory_type: "FLASH",
                    name: "FLASH1",
                    origin: 0x08000000,
                    length: 0x100000, // 1MB
                    attributes: "rx"
                }
            ]
        }
    },
    {
        name: "STM32F749",
        memories: {
            RAM: [
                {
                    memory_type: "RAM",
                    name: "RAM1",
                    origin: 0x20000000,
                    length: 320 * 1024, // 320KB
                    attributes: "xrw"
                }
            ],
            FLASH: [
                {
                    memory_type: "FLASH",
                    name: "FLASH1",
                    origin: 0x08000000,
                    length: 0x100000, // 1MB
                    attributes: "rx"
                }
            ]
        }
    }
    // Add more controller configurations as needed
];

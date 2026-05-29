(function () {
    const ns = window.RuruWorld = window.RuruWorld || {};

    ns.Config = {
        mapBounds: { minX: -360, maxX: 360, minZ: -285, maxZ: 330 },
        landBounds: { minX: -340, maxX: 315, minZ: -255, maxZ: 205 },
        waterLevel: -2.2,
        eyeHeight: 7.2,
        boatEyeHeight: 6.6,
        gravity: 44,
        speed: 20,
        runSpeed: 34,
        boatSpeed: 28,
        jumpForce: 26,
        playerRadius: 1.7,
        boatBoardRadius: 20,
        viewDistance: 940,
        minimapCamSize: 430,
        devGold: 999999999,
        staminaDrain: 22,
        staminaRegen: 18
    };

    ns.Perf = (function () {
        const mem = navigator.deviceMemory || 8;
        const cores = navigator.hardwareConcurrency || 8;
        const lowEnd = mem <= 4 || cores <= 4;
        const midEnd = !lowEnd && (mem <= 6 || cores <= 6);

        return {
            maxDpr: lowEnd ? 1 : (midEnd ? 1.5 : 2),
            antialias: !lowEnd,
            shadowMapSize: lowEnd ? 1024 : (midEnd ? 2048 : 4096),
            shadowType: lowEnd ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap
        };
    })();

    ns.Palette = {
        sky: new THREE.Color(0xa9ddec),
        grass: 0x87d879,
        grassLight: 0xa7e988,
        grassDark: 0x4fae64,
        forest: 0x2f8754,
        cliff: 0xd7bf8f,
        cliffShade: 0xb89465,
        path: 0xdcc99d,
        stone: 0xcfcfc4,
        stoneLight: 0xf2eedf,
        stoneDark: 0x8d9290,
        water: 0x39c5d4,
        waterDeep: 0x1b7295,
        brick: 0xb75f48,
        brickDark: 0x8f4639,
        roofRed: 0xc9553d,
        roofOrange: 0xe78a3f,
        roofYellow: 0xe7c64d,
        roofGreen: 0x66ad62,
        roofBlue: 0x4a82c8,
        cream: 0xf3ead1,
        whiteStone: 0xf2f3e8,
        wood: 0x9b6737,
        darkWood: 0x6f4729,
        gold: 0xd9a441,
        flowerPink: 0xf27e96,
        flowerBlue: 0x65a6e8,
        canvas: 0xf3f0df
    };

    ns.formatGold = function formatGold(value) {
        return `${Math.floor(value).toLocaleString("ko-KR")} G`;
    };

    ns.clamp = function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    };

    ns.smoothstep = function smoothstep(edge0, edge1, x) {
        const t = ns.clamp((x - edge0) / (edge1 - edge0), 0, 1);
        return t * t * (3 - 2 * t);
    };

    ns.mulberry32 = function mulberry32(seed) {
        return function () {
            let t = seed += 0x6d2b79f5;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    };
})();

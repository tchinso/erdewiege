(function () {
    const ns = window.RuruWorld = window.RuruWorld || {};
    const C = ns.Config;
    const P = ns.Palette;

    function hexCss(hex) {
        return `#${new THREE.Color(hex).getHexString()}`;
    }

    function rectHit(x, z, zone) {
        return x >= zone.x - zone.w / 2 && x <= zone.x + zone.w / 2 &&
            z >= zone.z - zone.d / 2 && z <= zone.z + zone.d / 2;
    }

    function ellipseHit(x, z, zone) {
        const dx = (x - zone.x) / zone.rx;
        const dz = (z - zone.z) / zone.rz;
        return dx * dx + dz * dz <= 1;
    }

    class MapEngine {
        constructor(scene, collision) {
            this.scene = scene;
            this.collision = collision;
            this.materials = {};
            this.heightZones = [];
            this.dockZones = [];
            this.portLandZones = [];
            this.places = [];
            this.waterMeshes = [];
            this.cloudGroup = null;
            this.playerBoat = null;
            this.dockBoat = null;
            this.tmpVec = new THREE.Vector3();
            this.rng = ns.mulberry32(240529);
            this.boatSpawn = { x: 144, z: 232 };
            this.portLanding = { x: 178, z: 174 };
        }

        build() {
            this.collision.reset();
            this.createMaterials();
            this.defineZones();
            this.addSea();
            this.addBaseTerrain();
            this.addRoadsAndWaterways();
            this.addSchoolDistrict();
            this.addCapitalDistrict();
            this.addShoppingDistrict();
            this.addResidentialDistrict();
            this.addPortDistrict();
            this.addForestsAndEdges();
            this.addClouds();
            this.registerPlaces();
            return this;
        }

        createMaterials() {
            this.materials.grass = this.paintedMaterial(P.grass, "grass");
            this.materials.grassLight = this.paintedMaterial(P.grassLight, "grass-light");
            this.materials.grassDark = this.paintedMaterial(P.grassDark, "grass-dark");
            this.materials.forest = this.paintedMaterial(P.forest, "forest");
            this.materials.cliff = this.paintedMaterial(P.cliff, "cliff");
            this.materials.cliffShade = this.paintedMaterial(P.cliffShade, "cliff-shade");
            this.materials.path = this.paintedMaterial(P.path, "path");
            this.materials.stone = this.paintedMaterial(P.stone, "stone");
            this.materials.stoneLight = this.paintedMaterial(P.stoneLight, "stone-light");
            this.materials.whiteStone = this.paintedMaterial(P.whiteStone, "white-stone");
            this.materials.brick = this.paintedMaterial(P.brick, "brick");
            this.materials.brickDark = this.paintedMaterial(P.brickDark, "brick-dark");
            this.materials.cream = this.paintedMaterial(P.cream, "cream");
            this.materials.roofRed = this.paintedMaterial(P.roofRed, "roof-red");
            this.materials.roofOrange = this.paintedMaterial(P.roofOrange, "roof-orange");
            this.materials.roofYellow = this.paintedMaterial(P.roofYellow, "roof-yellow");
            this.materials.roofGreen = this.paintedMaterial(P.roofGreen, "roof-green");
            this.materials.roofBlue = this.paintedMaterial(P.roofBlue, "roof-blue");
            this.materials.wood = this.paintedMaterial(P.wood, "wood");
            this.materials.darkWood = this.paintedMaterial(P.darkWood, "dark-wood");
            this.materials.gold = this.basicMaterial(P.gold);
            this.materials.canvas = this.paintedMaterial(P.canvas, "canvas");
            this.materials.waterFlat = new THREE.MeshStandardMaterial({
                color: P.water,
                roughness: 0.55,
                metalness: 0,
                transparent: true,
                opacity: 0.72
            });
            this.materials.window = new THREE.MeshStandardMaterial({
                color: 0x5fb4d7,
                roughness: 0.28,
                metalness: 0.05,
                emissive: 0x11384a,
                emissiveIntensity: 0.12
            });
            this.materials.shadow = new THREE.MeshStandardMaterial({
                color: 0x6f6049,
                transparent: true,
                opacity: 0.16,
                roughness: 1
            });
        }

        paintedMaterial(hex, variant) {
            const canvas = document.createElement("canvas");
            canvas.width = 96;
            canvas.height = 96;
            const ctx = canvas.getContext("2d");
            const base = new THREE.Color(hex);
            const light = base.clone().offsetHSL(0, -0.03, 0.12);
            const dark = base.clone().offsetHSL(0, 0.04, -0.12);
            const rng = ns.mulberry32((hex ^ variant.length * 2654435761) >>> 0);

            ctx.fillStyle = hexCss(hex);
            ctx.fillRect(0, 0, 96, 96);

            if (variant.indexOf("wood") >= 0) {
                for (let i = 0; i < 16; i++) {
                    const x = i * 6 + rng() * 2;
                    ctx.strokeStyle = i % 2 ? hexCss(dark.getHex()) : hexCss(light.getHex());
                    ctx.globalAlpha = 0.28;
                    ctx.lineWidth = 1 + rng() * 2;
                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.bezierCurveTo(x + rng() * 8 - 4, 24, x + rng() * 8 - 4, 58, x + rng() * 8 - 4, 96);
                    ctx.stroke();
                }
            } else if (variant.indexOf("stone") >= 0 || variant.indexOf("cliff") >= 0 || variant.indexOf("path") >= 0) {
                ctx.globalAlpha = 0.24;
                ctx.strokeStyle = hexCss(dark.getHex());
                for (let y = 0; y < 96; y += 18) {
                    ctx.beginPath();
                    ctx.moveTo(0, y + rng() * 4);
                    ctx.lineTo(96, y + rng() * 4);
                    ctx.stroke();
                }
                for (let x = 0; x < 96; x += 22) {
                    ctx.beginPath();
                    ctx.moveTo(x + rng() * 5, 0);
                    ctx.lineTo(x + rng() * 5, 96);
                    ctx.stroke();
                }
            } else if (variant.indexOf("roof") >= 0) {
                ctx.globalAlpha = 0.3;
                ctx.strokeStyle = hexCss(dark.getHex());
                for (let i = -96; i < 160; i += 12) {
                    ctx.beginPath();
                    ctx.moveTo(i, 96);
                    ctx.lineTo(i + 96, 0);
                    ctx.stroke();
                }
                ctx.globalAlpha = 0.16;
                ctx.strokeStyle = hexCss(light.getHex());
                for (let y = 8; y < 96; y += 16) {
                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.lineTo(96, y + rng() * 2);
                    ctx.stroke();
                }
            } else {
                for (let i = 0; i < 120; i++) {
                    ctx.fillStyle = rng() > 0.5 ? hexCss(light.getHex()) : hexCss(dark.getHex());
                    ctx.globalAlpha = 0.08 + rng() * 0.16;
                    ctx.fillRect(rng() * 96, rng() * 96, 1 + rng() * 5, 1 + rng() * 4);
                }
            }

            ctx.globalAlpha = 1;
            const texture = new THREE.CanvasTexture(canvas);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(2, 2);
            texture.anisotropy = 4;

            return new THREE.MeshStandardMaterial({
                map: texture,
                color: 0xffffff,
                flatShading: true,
                roughness: 0.92,
                metalness: 0
            });
        }

        basicMaterial(hex) {
            return new THREE.MeshStandardMaterial({
                color: hex,
                flatShading: true,
                roughness: 0.85,
                metalness: 0
            });
        }

        defineZones() {
            this.heightZones = [
                { id: "school", type: "rect", x: -166, z: -154, w: 184, d: 134, h: 14 },
                { id: "school-yard", type: "rect", x: -164, z: -80, w: 118, d: 50, h: 8 },
                { id: "capital-city", type: "rect", x: 158, z: -158, w: 196, d: 162, h: 10 },
                { id: "capital-palace", type: "rect", x: 158, z: -225, w: 112, d: 66, h: 24 },
                { id: "shopping", type: "rect", x: -210, z: 56, w: 168, d: 128, h: 3 },
                { id: "residential-lower", type: "rect", x: 28, z: 66, w: 172, d: 128, h: 5 },
                { id: "residential-mid", type: "rect", x: 36, z: 32, w: 132, d: 80, h: 10 },
                { id: "residential-upper", type: "rect", x: 52, z: -10, w: 92, d: 46, h: 16 },
                { id: "port-quay", type: "rect", x: 186, z: 154, w: 164, d: 78, h: 2.6 },
                { id: "port-market", type: "rect", x: 188, z: 108, w: 146, d: 62, h: 3.2 }
            ];

            this.dockZones = [
                { x: 184, z: 210, w: 26, d: 102, h: 3 },
                { x: 144, z: 205, w: 84, d: 18, h: 3 },
                { x: 222, z: 202, w: 80, d: 16, h: 3 },
                { x: 184, z: 256, w: 92, d: 18, h: 3 }
            ];

            this.portLandZones = [
                { x: 186, z: 154, w: 170, d: 88 },
                { x: 188, z: 108, w: 150, d: 70 }
            ];
        }

        heightAt(x, z) {
            for (let i = 0; i < this.dockZones.length; i++) {
                if (rectHit(x, z, this.dockZones[i])) return this.dockZones[i].h;
            }

            let height = 0;
            for (let i = 0; i < this.heightZones.length; i++) {
                const zone = this.heightZones[i];
                const hit = zone.type === "ellipse" ? ellipseHit(x, z, zone) : rectHit(x, z, zone);
                if (hit) height = Math.max(height, zone.h);
            }

            return height;
        }

        isDock(x, z) {
            return this.dockZones.some((zone) => rectHit(x, z, zone));
        }

        isPortLand(x, z) {
            return this.portLandZones.some((zone) => rectHit(x, z, zone));
        }

        isSea(x, z) {
            if (this.isDock(x, z) || this.isPortLand(x, z)) return false;
            return z > 198 || (x > 298 && z > 90) || (x > 118 && z > 174);
        }

        isBoatAllowed(x, z) {
            return this.isSea(x, z);
        }

        addSea() {
            const waterGeo = new THREE.PlaneGeometry(820, 680, 130, 100);
            waterGeo.rotateX(-Math.PI / 2);
            const waterMat = new THREE.ShaderMaterial({
                uniforms: {
                    time: { value: 0 },
                    color: { value: new THREE.Color(P.water) },
                    deepColor: { value: new THREE.Color(P.waterDeep) },
                    sunDirection: { value: new THREE.Vector3(0.55, 0.8, 0.25).normalize() }
                },
                vertexShader: `
                    uniform float time;
                    varying vec3 vWorld;
                    varying float vWave;
                    void main() {
                        vec3 pos = position;
                        float waveA = sin(pos.x * 0.045 + time * 1.3) * 0.55;
                        float waveB = cos(pos.z * 0.055 + time * 1.0) * 0.45;
                        float waveC = sin((pos.x + pos.z) * 0.025 + time * 0.7) * 0.32;
                        vWave = waveA + waveB + waveC;
                        pos.y += vWave;
                        vWorld = (modelMatrix * vec4(pos, 1.0)).xyz;
                        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(pos, 1.0);
                    }
                `,
                fragmentShader: `
                    uniform vec3 color;
                    uniform vec3 deepColor;
                    uniform vec3 sunDirection;
                    varying vec3 vWorld;
                    varying float vWave;
                    void main() {
                        vec3 dx = dFdx(vWorld);
                        vec3 dy = dFdy(vWorld);
                        vec3 normal = normalize(cross(dx, dy));
                        float light = max(dot(normal, sunDirection), 0.0);
                        float foam = smoothstep(0.6, 1.3, vWave);
                        vec3 surface = mix(deepColor, color, light * 0.55 + 0.45);
                        surface = mix(surface, vec3(0.95, 1.0, 0.95), foam * 0.45);
                        gl_FragColor = vec4(surface, 0.72);
                    }
                `,
                transparent: true,
                depthWrite: false,
                side: THREE.DoubleSide,
                extensions: { derivatives: true }
            });

            const water = new THREE.Mesh(waterGeo, waterMat);
            water.position.set(0, C.waterLevel, 20);
            water.receiveShadow = false;
            this.scene.add(water);
            this.waterMeshes.push(water);

            const foamMat = new THREE.MeshBasicMaterial({ color: 0xe9fff7, transparent: true, opacity: 0.4 });
            this.createRibbon([[118, 183], [154, 190], [210, 196], [300, 204]], 5, foamMat, { constantY: C.waterLevel + 0.18 });
            this.createRibbon([[-335, 206], [-160, 211], [40, 208], [116, 196]], 4, foamMat, { constantY: C.waterLevel + 0.18 });
        }

        addBaseTerrain() {
            this.addBox(680, 16, 466, this.materials.cliff, 0, -8, -25);
            this.addBox(660, 0.35, 446, this.materials.grass, 0, 0.18, -25);

            this.addBox(690, 22, 14, this.materials.cliffShade, 0, -9, 210);
            this.addBox(690, 22, 12, this.materials.cliffShade, 0, -9, -258);
            this.addBox(12, 22, 466, this.materials.cliffShade, -346, -9, -25);
            this.addBox(12, 22, 466, this.materials.cliffShade, 326, -9, -25);

            this.addPlatform(-166, -154, 184, 134, 14, this.materials.grassLight);
            this.addPlatform(-164, -80, 118, 50, 8, this.materials.grassLight);
            this.addPlatform(158, -158, 196, 162, 10, this.materials.stoneLight);
            this.addPlatform(158, -225, 112, 66, 24, this.materials.stoneLight);
            this.addPlatform(-210, 56, 168, 128, 3, this.materials.grassLight);
            this.addPlatform(28, 66, 172, 128, 5, this.materials.grassLight);
            this.addPlatform(36, 32, 132, 80, 10, this.materials.grassLight);
            this.addPlatform(52, -10, 92, 46, 16, this.materials.grassLight);
            this.addPlatform(186, 154, 164, 78, 2.6, this.materials.stoneLight);
            this.addPlatform(188, 108, 146, 62, 3.2, this.materials.stoneLight);

            this.addLowWall(-166, -154, 184, 134, 14.2);
            this.addLowWall(158, -158, 196, 162, 10.3, this.materials.whiteStone);
            this.addLowWall(28, 66, 172, 128, 5.3);
        }

        addRoadsAndWaterways() {
            const river = [[-322, -224], [-262, -172], [-232, -84], [-204, 0], [-118, 26], [-22, 24], [66, 58], [132, 118], [260, 188]];
            this.createRibbon(river, 15, this.materials.waterFlat, { constantY: 0.45 });

            const mainRoads = [
                [[-166, -82], [-110, -74], [-44, -88], [36, -104], [74, -116]],
                [[-168, -84], [-188, -32], [-214, 32], [-220, 78]],
                [[-146, 64], [-72, 76], [8, 72], [72, 78], [130, 110], [172, 146]],
                [[160, -80], [168, -24], [178, 52], [184, 104]],
                [[-38, 32], [20, 24], [52, -2]]
            ];

            for (let i = 0; i < mainRoads.length; i++) {
                this.createRibbon(mainRoads[i], i === 0 ? 10 : 8, this.materials.path, { yOffset: 0.18 });
            }

            this.addBridge(-228, -54, 34, 11, -0.34);
            this.addBridge(-58, 26, 34, 10, Math.PI / 2);
            this.addBridge(148, 132, 42, 12, -0.72);
        }

        addSchoolDistrict() {
            this.addStonePlaza(-166, -102, 82, 38, 8.35, 0);
            this.addStairs(-166, -72, 54, 7, "south", 8, 0);
            this.addAcademy(-166, -158);

            this.addHouse(-238, -120, {
                w: 26, d: 22, h: 13, roof: "red", wall: this.materials.brick,
                rot: 0.12, sign: "dorm", label: "기숙사"
            });
            this.addObservatory(-90, -120);
            this.addChapel(-110, -206);
            this.addPyramidRuins(-292, -224);
            this.addAncientArch(-276, -54);
            this.addColosseum(-104, -28);
            this.addGiantTree(-38, -222);

            for (let i = 0; i < 46; i++) {
                const x = -308 + this.rng() * 270;
                const z = -244 + this.rng() * 240;
                if (x > -250 && x < -70 && z > -220 && z < -70) continue;
                if (this.isSea(x, z)) continue;
                this.addTree(x, z, 0.8 + this.rng() * 0.6, this.rng() > 0.45 ? "pine" : "round");
            }
        }

        addCapitalDistrict() {
            this.addCapitalWalls(158, -158, 196, 162);
            this.addStairs(158, -93, 68, 7, "south", 10, 3);
            this.addStonePlaza(158, -145, 92, 54, 10.35, 0);
            this.addFountain(158, -145, 10.6);
            this.addPalace(158, -226);

            const houses = [
                [86, -176, "orange", -0.2, 24, 20],
                [112, -112, "red", 0.18, 22, 18],
                [205, -120, "orange", -0.26, 23, 20],
                [232, -174, "yellow", 0.12, 22, 19],
                [94, -218, "green", 0.14, 20, 17],
                [218, -218, "blue", -0.18, 20, 18]
            ];
            houses.forEach((h, idx) => {
                this.addHouse(h[0], h[1], {
                    w: h[4], d: h[5], h: 11 + (idx % 2) * 2,
                    roof: h[2], wall: this.materials.cream, rot: h[3], sign: idx % 2 ? "office" : "noble"
                });
            });

            this.addDomeHall(236, -88);
            this.addClockTower(82, -88, 10.2, 18, this.materials.whiteStone, this.materials.roofBlue);

            for (let i = 0; i < 24; i++) {
                const x = 74 + this.rng() * 170;
                const z = -228 + this.rng() * 150;
                if (Math.abs(x - 158) < 34 && z < -172) continue;
                this.addTree(x, z, 0.55 + this.rng() * 0.4, "round", P.grassDark);
            }
        }

        addShoppingDistrict() {
            this.addStonePlaza(-214, 54, 56, 46, 3.35, 0.18);
            this.addSignPost(-214, 54, 3.6);
            this.addWell(-196, 62, 3.55);

            const shops = [
                [-268, 32, "orange", "bread", 0.26, 25, 20],
                [-230, -2, "yellow", "general", -0.16, 24, 18],
                [-168, 20, "green", "potion", 0.18, 23, 18],
                [-146, 72, "red", "blacksmith", -0.22, 26, 20],
                [-222, 116, "blue", "inn", 0.1, 31, 21],
                [-282, 86, "green", "cloth", -0.32, 22, 18],
                [-164, 112, "red", "magic", 0.22, 22, 18]
            ];
            shops.forEach((s) => {
                this.addHouse(s[0], s[1], {
                    w: s[5], d: s[6], h: 11,
                    roof: s[2], wall: this.materials.cream,
                    rot: s[4], sign: s[3], awning: true
                });
            });

            this.addMarketTent(-252, 70, P.roofYellow);
            this.addMarketTent(-188, 92, P.roofGreen);
            this.addCrateCluster(-156, 48, 3.4);
            this.addCrateCluster(-248, 104, 3.4);
            this.addFence(-294, 18, -286, 108, 3.5);
            this.addFence(-136, 24, -128, 108, 3.5);

            for (let i = 0; i < 20; i++) {
                const x = -292 + this.rng() * 170;
                const z = -2 + this.rng() * 130;
                if (Math.abs(x + 214) < 36 && Math.abs(z - 54) < 30) continue;
                this.addTree(x, z, 0.5 + this.rng() * 0.35, "round");
            }
        }

        addResidentialDistrict() {
            this.addStonePlaza(28, 66, 70, 54, 5.35, 0.16);
            this.addTotem(28, 66, 5.6, 1.25);
            this.addStairs(28, 28, 44, 5, "north", 10, 5);
            this.addStairs(20, 106, 56, 5, "south", 5, 0);

            const homes = [
                [-38, 38, "yellow", -0.18],
                [0, 116, "orange", 0.16],
                [72, 112, "red", -0.2],
                [94, 48, "green", 0.22],
                [-34, 84, "blue", 0.12],
                [58, 4, "orange", -0.16],
                [88, -18, "yellow", 0.18]
            ];
            homes.forEach((h, idx) => {
                this.addHouse(h[0], h[1], {
                    w: 23 + (idx % 2) * 5,
                    d: 19,
                    h: 9 + (idx % 3),
                    roof: h[2],
                    wall: this.materials.cream,
                    rot: h[3],
                    sign: idx % 3 === 0 ? "home" : "pot",
                    tribal: true
                });
            });

            this.addRoundRuin(-62, 54, 5.5);
            this.addRuinHall(62, -16, 16.3);
            this.addStorageArch(118, 76, 5.4);
            this.addLaundryLine(-12, 104, 5.8);
            this.addGardenPatch(98, 102, 5.4);
            this.addCrateCluster(-36, 116, 5.5);

            for (let i = 0; i < 34; i++) {
                const x = -64 + this.rng() * 210;
                const z = -36 + this.rng() * 170;
                if (Math.abs(x - 28) < 42 && Math.abs(z - 66) < 34) continue;
                this.addTree(x, z, 0.55 + this.rng() * 0.48, this.rng() > 0.72 ? "ancient" : "round");
            }
        }

        addPortDistrict() {
            this.addQuayDetails();
            this.addDocks();
            this.addMerchantShip(184, 260);
            this.dockBoat = this.addSmallBoat(140, 209, 0.68, -Math.PI / 2, false);
            this.playerBoat = this.addSmallBoat(0, 0, 0.72, 0, true);
            this.playerBoat.visible = false;

            const buildings = [
                [124, 118, "orange", "fish", 0.12, 26, 20],
                [162, 96, "green", "fruit", -0.14, 24, 18],
                [204, 96, "red", "trade", 0.16, 30, 20],
                [248, 122, "blue", "inn", -0.18, 27, 20],
                [224, 158, "yellow", "repair", 0.08, 28, 20]
            ];
            buildings.forEach((b) => {
                this.addHouse(b[0], b[1], {
                    w: b[5], d: b[6], h: 11,
                    roof: b[2], wall: this.materials.cream,
                    rot: b[4], sign: b[3], awning: true
                });
            });

            this.addCrateCluster(160, 166, 3.1);
            this.addCrateCluster(208, 182, 3.1);
            this.addBarrels(126, 162, 3.1);
            this.addMarketTent(140, 94, P.roofGreen);
            this.addMarketTent(188, 132, P.roofRed);
            this.addHarborWall();
        }

        addForestsAndEdges() {
            const clusters = [
                [-315, -126, 64, 120, 34],
                [-305, 86, 58, 120, 28],
                [294, -10, 42, 160, 22],
                [0, -248, 230, 24, 24],
                [-12, 194, 250, 18, 18]
            ];

            clusters.forEach((cluster) => {
                for (let i = 0; i < cluster[4]; i++) {
                    const x = cluster[0] + (this.rng() - 0.5) * cluster[2];
                    const z = cluster[1] + (this.rng() - 0.5) * cluster[3];
                    if (this.isSea(x, z)) continue;
                    this.addTree(x, z, 0.75 + this.rng() * 0.75, this.rng() > 0.38 ? "round" : "pine");
                }
            });

            for (let i = 0; i < 48; i++) {
                const side = Math.floor(this.rng() * 4);
                let x = -330 + this.rng() * 640;
                let z = -240 + this.rng() * 430;
                if (side === 0) z = -244 + this.rng() * 24;
                if (side === 1) z = 176 + this.rng() * 28;
                if (side === 2) x = -332 + this.rng() * 26;
                if (side === 3) x = 296 + this.rng() * 26;
                if (this.isSea(x, z)) continue;
                this.addRock(x, z, 1.2 + this.rng() * 1.8);
            }
        }

        registerPlaces() {
            this.places = [
                {
                    id: "school", label: "학교 메뉴", title: "학교",
                    x: -166, z: -112, radius: 98, zoneRadius: 104,
                    body: "붉은 벽돌 아카데미와 시계탑, 기숙사, 연구동이 이어진 테스트 허브입니다.",
                    items: ["수업 테스트", "기숙사", "연구동", "훈련장"]
                },
                {
                    id: "capital", label: "수도 메뉴", title: "수도",
                    x: 158, z: -145, radius: 110, zoneRadius: 112,
                    body: "하얀 성벽과 파란 지붕의 왕궁, 중앙 광장, 관리 건물이 있는 수도 구역입니다.",
                    items: ["왕궁 알현", "광장 게시판", "관리 사무소"]
                },
                {
                    id: "shopping", label: "상점가 메뉴", title: "상점가",
                    x: -214, z: 54, radius: 98, zoneRadius: 98,
                    body: "빵집, 약초상, 대장간, 여관 간판이 모여 있는 생활형 상업 구역입니다.",
                    items: ["빵집", "약초상", "대장간", "여관"]
                },
                {
                    id: "residential", label: "거주지역 대화", title: "거주지역",
                    x: 28, z: 66, radius: 104, zoneRadius: 104,
                    body: "토템과 공동 마당을 중심으로 계단식 집과 오래된 석조 유적이 섞여 있습니다.",
                    items: ["주민 인사", "공동 마당", "마을 회관"]
                },
                {
                    id: "port", label: "항구 메뉴", title: "항구",
                    x: 182, z: 164, radius: 112, zoneRadius: 112,
                    body: "목조 부두, 무역선, 작은 돛단배가 있는 바다 출입구입니다.",
                    items: ["돛단배", "무역소", "선원 여관"]
                }
            ];

            this.places.forEach((place) => this.collision.addInteraction(place));
        }

        getLocation(x, z, state) {
            if (state && state.onBoat && this.isSea(x, z)) return "바다";
            if (this.isSea(x, z)) return "바다";

            for (let i = 0; i < this.places.length; i++) {
                const place = this.places[i];
                const dx = x - place.x;
                const dz = z - place.z;
                if (dx * dx + dz * dz < place.zoneRadius * place.zoneRadius) {
                    return place.title;
                }
            }
            return "필드";
        }

        handleInteraction(item, state, ui) {
            if (!item) return null;

            if (item.id === "port") {
                if (!state.hasBoat || !state.onBoat) {
                    state.hasBoat = true;
                    state.onBoat = true;
                    ui.setBoatStatus("승선 중");
                    ui.showDialog({
                        title: "항구",
                        body: "항구 관리인이 작은 돛단배를 내어줬습니다. 이제 바다 위로 이동할 수 있습니다.",
                        items: ["작은 돛단배 획득", "출항 테스트", "바다 진입 허용"]
                    });
                    return { moveTo: this.boatSpawn, mode: "boat" };
                }

                state.onBoat = false;
                ui.setBoatStatus("보유");
                ui.showDialog({
                    title: "항구",
                    body: "돛단배를 부두에 묶고 항구로 내렸습니다.",
                    items: ["정박", "무역소", "항구 거리"]
                });
                return { moveTo: this.portLanding, mode: "land" };
            }

            ui.showDialog({
                title: item.title,
                body: item.body,
                items: item.items
            });
            return null;
        }

        showSeaDialog(ui) {
            ui.showDialog({
                title: "바다",
                body: "돛단배에 탄 상태로만 접근 가능한 테스트 바다입니다. 잔잔한 물결과 항구 주변 항로를 확인할 수 있습니다.",
                items: ["항해 테스트", "낚시 메뉴", "항구 복귀"]
            });
        }

        updateAnimated(time, camera, state) {
            for (let i = 0; i < this.waterMeshes.length; i++) {
                const mesh = this.waterMeshes[i];
                if (mesh.material && mesh.material.uniforms && mesh.material.uniforms.time) {
                    mesh.material.uniforms.time.value = time;
                }
            }

            if (this.cloudGroup) {
                this.cloudGroup.position.x = Math.sin(time * 0.045) * 26;
                this.cloudGroup.position.z = Math.cos(time * 0.035) * 14;
            }

            if (this.playerBoat) {
                if (state.onBoat) {
                    camera.getWorldDirection(this.tmpVec);
                    const angle = Math.atan2(this.tmpVec.x, this.tmpVec.z);
                    this.playerBoat.visible = true;
                    this.playerBoat.position.set(camera.position.x, C.waterLevel + 0.28, camera.position.z);
                    this.playerBoat.rotation.y = angle;
                    if (this.dockBoat) this.dockBoat.visible = false;
                } else {
                    this.playerBoat.visible = false;
                    if (this.dockBoat) this.dockBoat.visible = true;
                }
            }
        }

        addPlatform(x, z, w, d, h, topMat) {
            this.addBox(w, h, d, this.materials.cliff, x, h / 2, z);
            this.addBox(w - 2, 0.45, d - 2, topMat || this.materials.grass, x, h + 0.1, z);
        }

        addLowWall(x, z, w, d, y, mat) {
            const material = mat || this.materials.stone;
            const h = 2.8;
            this.addBox(w, h, 2.4, material, x, y + h / 2, z - d / 2);
            this.addBox(w, h, 2.4, material, x, y + h / 2, z + d / 2);
            this.addBox(2.4, h, d, material, x - w / 2, y + h / 2, z);
            this.addBox(2.4, h, d, material, x + w / 2, y + h / 2, z);
        }

        addStonePlaza(x, z, w, d, y, rot) {
            const mesh = this.addBox(w, 0.35, d, this.materials.stoneLight, x, y, z, rot || 0);
            mesh.receiveShadow = true;
        }

        addBox(w, h, d, material, x, y, z, rotY) {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
            mesh.position.set(x, y, z);
            mesh.rotation.y = rotY || 0;
            this.enableShadow(mesh);
            this.scene.add(mesh);
            return mesh;
        }

        addCylinder(radiusTop, radiusBottom, height, material, x, y, z, segments) {
            const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments || 12), material);
            mesh.position.set(x, y, z);
            this.enableShadow(mesh);
            this.scene.add(mesh);
            return mesh;
        }

        addCone(radius, height, material, x, y, z, segments) {
            const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, height, segments || 12), material);
            mesh.position.set(x, y, z);
            this.enableShadow(mesh);
            this.scene.add(mesh);
            return mesh;
        }

        addSphere(radius, material, x, y, z, scaleY) {
            const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 1), material);
            mesh.position.set(x, y, z);
            mesh.scale.y = scaleY || 1;
            this.enableShadow(mesh);
            this.scene.add(mesh);
            return mesh;
        }

        enableShadow(obj) {
            obj.castShadow = true;
            obj.receiveShadow = true;
            if (obj.traverse) {
                obj.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
            }
        }

        createRibbon(points, width, material, options) {
            const opts = options || {};
            const verts = [];
            const uvs = [];
            const indices = [];
            const half = width / 2;

            for (let i = 0; i < points.length; i++) {
                const p = points[i];
                const prev = points[Math.max(0, i - 1)];
                const next = points[Math.min(points.length - 1, i + 1)];
                const x = p[0];
                const z = p[1];
                const dx = next[0] - prev[0];
                const dz = next[1] - prev[1];
                const len = Math.max(0.001, Math.sqrt(dx * dx + dz * dz));
                const nx = -dz / len;
                const nz = dx / len;
                const y = opts.constantY !== undefined ? opts.constantY : this.heightAt(x, z) + (opts.yOffset || 0.12);

                verts.push(x + nx * half, y, z + nz * half);
                verts.push(x - nx * half, y, z - nz * half);
                uvs.push(0, i / 3, 1, i / 3);

                if (i < points.length - 1) {
                    const a = i * 2;
                    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
                }
            }

            const geo = new THREE.BufferGeometry();
            geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
            geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
            geo.setIndex(indices);
            geo.computeVertexNormals();
            const mesh = new THREE.Mesh(geo, material);
            mesh.receiveShadow = true;
            this.scene.add(mesh);
            return mesh;
        }

        addBridge(x, z, w, d, rot) {
            const y = this.heightAt(x, z) + 1.2;
            const bridge = new THREE.Group();
            bridge.position.set(x, y, z);
            bridge.rotation.y = rot || 0;
            const deck = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, d), this.materials.wood);
            deck.position.y = 0;
            bridge.add(deck);
            for (let i = -1; i <= 1; i += 2) {
                const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 2, 1), this.materials.darkWood);
                rail.position.set(0, 1.2, i * d / 2);
                bridge.add(rail);
            }
            this.enableShadow(bridge);
            this.scene.add(bridge);
            this.collision.addObstacle(x, z, Math.max(w, d) * 0.2);
        }

        roofMaterial(name) {
            if (name === "blue") return this.materials.roofBlue;
            if (name === "green") return this.materials.roofGreen;
            if (name === "yellow") return this.materials.roofYellow;
            if (name === "red") return this.materials.roofRed;
            return this.materials.roofOrange;
        }

        makeRoofGeometry(w, d, h) {
            const hw = w / 2;
            const hd = d / 2;
            const verts = [
                -hw, 0, -hd, hw, 0, -hd, 0, h, -hd,
                -hw, 0, hd, hw, 0, hd, 0, h, hd
            ];
            const idx = [
                0, 1, 2, 4, 3, 5,
                3, 0, 2, 3, 2, 5,
                1, 4, 5, 1, 5, 2,
                0, 3, 4, 0, 4, 1
            ];
            const geo = new THREE.BufferGeometry();
            geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
            geo.setIndex(idx);
            geo.computeVertexNormals();
            return geo;
        }

        addHouse(x, z, opts) {
            const y = this.heightAt(x, z);
            const group = new THREE.Group();
            const w = opts.w || 24;
            const d = opts.d || 18;
            const h = opts.h || 10;
            const wall = opts.wall || this.materials.cream;
            const roofMat = this.roofMaterial(opts.roof);

            group.position.set(x, y, z);
            group.rotation.y = opts.rot || 0;

            const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wall);
            base.position.y = h / 2;
            group.add(base);

            const roof = new THREE.Mesh(this.makeRoofGeometry(w + 4, d + 4, 6), roofMat);
            roof.position.y = h;
            group.add(roof);

            const door = new THREE.Mesh(new THREE.BoxGeometry(4.2, 6, 0.55), this.materials.darkWood);
            door.position.set(0, 3, -d / 2 - 0.28);
            group.add(door);

            for (let i = -1; i <= 1; i += 2) {
                const windowMesh = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3, 0.45), this.materials.window);
                windowMesh.position.set(i * w * 0.28, 6.2, -d / 2 - 0.3);
                group.add(windowMesh);
            }

            const chimney = new THREE.Mesh(new THREE.BoxGeometry(2.5, 5, 2.5), this.materials.brickDark);
            chimney.position.set(w * 0.25, h + 4, 1);
            group.add(chimney);

            if (opts.awning) {
                const awning = new THREE.Mesh(new THREE.BoxGeometry(w * 0.56, 1.4, 4.8), this.roofMaterial(opts.roof === "yellow" ? "green" : "yellow"));
                awning.position.set(0, 5.5, -d / 2 - 2.7);
                group.add(awning);
            }

            if (opts.tribal) {
                for (let i = -1; i <= 1; i += 2) {
                    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.6, h * 0.7, 0.45), this.materials.roofRed);
                    stripe.position.set(i * w * 0.38, h * 0.46, -d / 2 - 0.32);
                    group.add(stripe);
                }
            }

            this.addSignIcon(group, opts.sign || "home", 0, h + 0.5, -d / 2 - 1.2);
            this.enableShadow(group);
            this.scene.add(group);
            this.collision.addObstacle(x, z, Math.max(w, d) * 0.45);
            return group;
        }

        addSignIcon(group, kind, x, y, z) {
            const board = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3, 0.5), this.materials.wood);
            board.position.set(x, y, z);
            group.add(board);

            let icon;
            if (kind === "potion" || kind === "magic") {
                icon = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), this.basicMaterial(kind === "magic" ? P.roofBlue : P.roofGreen));
            } else if (kind === "bread" || kind === "inn") {
                icon = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.34, 8, 14), this.basicMaterial(kind === "bread" ? P.roofYellow : P.roofOrange));
            } else if (kind === "blacksmith" || kind === "repair") {
                icon = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 0.7), this.basicMaterial(P.stoneDark));
            } else if (kind === "fish") {
                icon = new THREE.Mesh(new THREE.ConeGeometry(1.15, 2.4, 3), this.basicMaterial(P.waterDeep));
                icon.rotation.z = Math.PI / 2;
            } else if (kind === "fruit") {
                icon = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), this.basicMaterial(P.roofOrange));
            } else if (kind === "trade") {
                icon = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.9, 0.7), this.materials.gold);
            } else {
                icon = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 0.7), this.basicMaterial(P.grassDark));
            }
            icon.position.set(x, y, z - 0.45);
            group.add(icon);
        }

        addAcademy(x, z) {
            const y = this.heightAt(x, z);
            const group = new THREE.Group();
            group.position.set(x, y, z);

            const main = new THREE.Mesh(new THREE.BoxGeometry(74, 24, 34), this.materials.brick);
            main.position.y = 12;
            group.add(main);
            const roof = new THREE.Mesh(this.makeRoofGeometry(82, 40, 12), this.materials.roofRed);
            roof.position.y = 24;
            group.add(roof);

            const hall = new THREE.Mesh(new THREE.BoxGeometry(32, 18, 24), this.materials.brickDark);
            hall.position.set(0, 9, -26);
            group.add(hall);
            const hallRoof = new THREE.Mesh(this.makeRoofGeometry(38, 30, 9), this.materials.roofRed);
            hallRoof.position.set(0, 18, -26);
            group.add(hallRoof);

            const tower = new THREE.Mesh(new THREE.BoxGeometry(18, 42, 18), this.materials.stone);
            tower.position.set(0, 21, -2);
            group.add(tower);
            const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(13, 22, 6), this.materials.roofBlue);
            towerRoof.position.set(0, 53, -2);
            group.add(towerRoof);
            const clock = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 4.8, 0.6, 24), this.materials.canvas);
            clock.position.set(0, 36, -11.2);
            clock.rotation.x = Math.PI / 2;
            group.add(clock);

            for (let i = -1; i <= 1; i++) {
                for (let j = 0; j < 2; j++) {
                    const win = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 0.5), this.materials.window);
                    win.position.set(i * 24, 10 + j * 8, -17.4);
                    group.add(win);
                }
            }

            for (let i = -1; i <= 1; i += 2) {
                const wing = new THREE.Mesh(new THREE.BoxGeometry(28, 16, 26), this.materials.brick);
                wing.position.set(i * 52, 8, 0);
                group.add(wing);
                const wingRoof = new THREE.Mesh(this.makeRoofGeometry(34, 32, 8), this.materials.roofRed);
                wingRoof.position.set(i * 52, 16, 0);
                group.add(wingRoof);
            }

            this.enableShadow(group);
            this.scene.add(group);
            this.collision.addObstacle(x, z, 42);
        }

        addObservatory(x, z) {
            const y = this.heightAt(x, z);
            this.addCylinder(10, 11, 18, this.materials.stone, x, y + 9, z, 18);
            this.addSphere(11, this.materials.roofBlue, x, y + 21, z, 0.55);
            this.addCylinder(2, 2, 18, this.materials.darkWood, x + 6, y + 28, z - 2, 12).rotation.z = Math.PI / 2.8;
            this.collision.addObstacle(x, z, 13);
        }

        addChapel(x, z) {
            this.addHouse(x, z, { w: 28, d: 34, h: 14, roof: "blue", wall: this.materials.stone, rot: -0.2, sign: "chapel" });
            const y = this.heightAt(x, z);
            this.addCone(6, 18, this.materials.roofBlue, x - 11, y + 31, z - 12, 6);
        }

        addPyramidRuins(x, z) {
            const y = this.heightAt(x, z);
            for (let i = 0; i < 4; i++) {
                this.addBox(40 - i * 8, 4, 40 - i * 8, this.materials.cliff, x, y + 2 + i * 4, z);
            }
            this.addBox(10, 12, 8, this.materials.stoneDark, x, y + 20, z - 4);
            this.collision.addObstacle(x, z, 24);
        }

        addAncientArch(x, z) {
            const y = this.heightAt(x, z);
            this.addBox(6, 20, 8, this.materials.stone, x - 10, y + 10, z);
            this.addBox(6, 20, 8, this.materials.stone, x + 10, y + 10, z);
            this.addBox(26, 6, 8, this.materials.stone, x, y + 22, z);
            this.addRock(x - 18, z + 8, 2);
            this.addRock(x + 18, z - 6, 2.4);
            this.collision.addObstacle(x - 10, z, 5);
            this.collision.addObstacle(x + 10, z, 5);
        }

        addColosseum(x, z) {
            const y = this.heightAt(x, z);
            const ringMat = this.materials.stone;
            for (let i = 0; i < 18; i++) {
                const a = (i / 18) * Math.PI * 2;
                const bx = x + Math.cos(a) * 26;
                const bz = z + Math.sin(a) * 18;
                const p = this.addBox(5, 10, 5, ringMat, bx, y + 5, bz, -a);
                p.scale.y = i % 3 === 0 ? 0.75 : 1;
            }
            this.addBox(34, 0.4, 22, this.materials.path, x, y + 0.25, z);
            this.collision.addObstacle(x, z, 24);
        }

        addGiantTree(x, z) {
            const y = this.heightAt(x, z);
            this.addCylinder(5, 7, 28, this.materials.darkWood, x, y + 14, z, 10);
            for (let i = 0; i < 7; i++) {
                const a = (i / 7) * Math.PI * 2;
                this.addSphere(15 + (i % 2) * 4, this.materials.forest, x + Math.cos(a) * 11, y + 34 + (i % 3) * 3, z + Math.sin(a) * 10, 0.85);
            }
            this.addBox(36, 2.2, 28, this.materials.stone, x, y + 1.1, z + 24, 0.2);
            this.collision.addObstacle(x, z, 18);
        }

        addCapitalWalls(x, z, w, d) {
            const y = this.heightAt(x, z);
            const mat = this.materials.whiteStone;
            this.addBox(w, 13, 5, mat, x, y + 6.5, z - d / 2);
            this.addBox(w, 13, 5, mat, x, y + 6.5, z + d / 2);
            this.addBox(5, 13, d, mat, x - w / 2, y + 6.5, z);
            this.addBox(5, 13, d, mat, x + w / 2, y + 6.5, z);
            const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
            corners.forEach((c) => {
                this.addCylinder(9, 9, 17, mat, x + c[0] * w / 2, y + 8.5, z + c[1] * d / 2, 14);
                this.addCone(10, 10, this.materials.roofBlue, x + c[0] * w / 2, y + 22, z + c[1] * d / 2, 14);
            });
            this.addBox(36, 18, 7, mat, x, y + 9, z + d / 2 + 1);
            this.addBox(14, 12, 8, this.materials.darkWood, x, y + 6, z + d / 2 + 4);
            this.collision.addObstacleLine(x - w / 2, z - d / 2, x + w / 2, z - d / 2, 3.5);
            this.collision.addObstacleLine(x - w / 2, z + d / 2, x - 23, z + d / 2, 3.5);
            this.collision.addObstacleLine(x + 23, z + d / 2, x + w / 2, z + d / 2, 3.5);
            this.collision.addObstacleLine(x - w / 2, z - d / 2, x - w / 2, z + d / 2, 3.5);
            this.collision.addObstacleLine(x + w / 2, z - d / 2, x + w / 2, z + d / 2, 3.5);
        }

        addPalace(x, z) {
            const y = this.heightAt(x, z);
            const group = new THREE.Group();
            group.position.set(x, y, z);
            const base = new THREE.Mesh(new THREE.BoxGeometry(72, 28, 34), this.materials.whiteStone);
            base.position.y = 14;
            group.add(base);
            const roof = new THREE.Mesh(this.makeRoofGeometry(80, 42, 14), this.materials.roofBlue);
            roof.position.y = 28;
            group.add(roof);
            for (let i = -1; i <= 1; i += 2) {
                const tower = new THREE.Mesh(new THREE.CylinderGeometry(9, 10, 38, 16), this.materials.whiteStone);
                tower.position.set(i * 42, 19, -1);
                group.add(tower);
                const cone = new THREE.Mesh(new THREE.ConeGeometry(11, 18, 16), this.materials.roofBlue);
                cone.position.set(i * 42, 47, -1);
                group.add(cone);
            }
            for (let i = -2; i <= 2; i++) {
                const col = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 15, 10), this.materials.stone);
                col.position.set(i * 9, 8, -18.3);
                group.add(col);
            }
            this.enableShadow(group);
            this.scene.add(group);
            this.collision.addObstacle(x, z, 42);
        }

        addFountain(x, z, y) {
            this.addCylinder(11, 12, 2.2, this.materials.stone, x, y + 1.1, z, 24);
            this.addCylinder(6, 6, 1, this.materials.waterFlat, x, y + 2.4, z, 24);
            this.addCylinder(2, 2, 8, this.materials.whiteStone, x, y + 5.4, z, 16);
            this.addSphere(3.6, this.materials.waterFlat, x, y + 10, z, 0.4);
        }

        addDomeHall(x, z) {
            const y = this.heightAt(x, z);
            this.addCylinder(16, 18, 13, this.materials.whiteStone, x, y + 6.5, z, 18);
            this.addSphere(17, this.materials.roofBlue, x, y + 16, z, 0.42);
            this.collision.addObstacle(x, z, 19);
        }

        addClockTower(x, z, y, height, wallMat, roofMat) {
            this.addBox(14, height, 14, wallMat, x, y + height / 2, z);
            this.addCone(10, 13, roofMat, x, y + height + 6.5, z, 12);
            const clock = this.addCylinder(3.3, 3.3, 0.5, this.materials.canvas, x, y + height - 4, z - 7.3, 20);
            clock.rotation.x = Math.PI / 2;
            this.collision.addObstacle(x, z, 10);
        }

        addSignPost(x, z, y) {
            this.addCylinder(0.7, 0.8, 8, this.materials.darkWood, x, y + 4, z, 8);
            this.addBox(15, 2.4, 1, this.materials.wood, x + 5, y + 7, z, 0.16);
            this.addBox(13, 2.2, 1, this.materials.wood, x - 5, y + 4.4, z, -0.18);
        }

        addWell(x, z, y) {
            this.addCylinder(6, 6, 4, this.materials.stone, x, y + 2, z, 18);
            this.addCylinder(4.8, 4.8, 0.8, this.materials.waterFlat, x, y + 4.2, z, 18);
            this.addBox(16, 1.6, 3, this.materials.wood, x, y + 10, z);
            this.addCone(9, 6, this.materials.roofRed, x, y + 13, z, 4).rotation.y = Math.PI / 4;
            this.collision.addObstacle(x, z, 7);
        }

        addMarketTent(x, z, color) {
            const y = this.heightAt(x, z);
            const mat = this.basicMaterial(color);
            this.addBox(18, 1.5, 14, mat, x, y + 7, z);
            this.addCone(13, 7, mat, x, y + 11, z, 4).rotation.y = Math.PI / 4;
            this.addBox(16, 3, 10, this.materials.wood, x, y + 1.5, z);
            this.collision.addObstacle(x, z, 9);
        }

        addTotem(x, z, y, scale) {
            this.addCylinder(2.4 * scale, 2.8 * scale, 18 * scale, this.materials.darkWood, x, y + 9 * scale, z, 8);
            this.addBox(8 * scale, 5 * scale, 3 * scale, this.materials.roofRed, x, y + 8 * scale, z - 1, 0.12);
            this.addBox(6 * scale, 4 * scale, 3 * scale, this.materials.roofBlue, x, y + 14 * scale, z - 1, -0.08);
            this.addCone(5 * scale, 7 * scale, this.materials.roofYellow, x, y + 21 * scale, z, 6);
            this.collision.addObstacle(x, z, 7 * scale);
        }

        addRoundRuin(x, z, y) {
            for (let i = 0; i < 14; i++) {
                const a = Math.PI * 0.1 + (i / 14) * Math.PI * 1.55;
                this.addCylinder(2, 2.4, 9 + (i % 3) * 2, this.materials.stone, x + Math.cos(a) * 23, y + 4.5, z + Math.sin(a) * 17, 8);
            }
        }

        addRuinHall(x, z, y) {
            this.addBox(44, 15, 24, this.materials.stone, x, y + 7.5, z);
            this.addBox(16, 12, 4, this.materials.darkWood, x, y + 6, z - 13);
            for (let i = -1; i <= 1; i += 2) {
                this.addBox(6, 19, 6, this.materials.stoneDark, x + i * 24, y + 9.5, z - 10);
            }
            this.collision.addObstacle(x, z, 24);
        }

        addStorageArch(x, z, y) {
            this.addBox(22, 10, 20, this.materials.stone, x, y + 5, z);
            this.addCylinder(7, 7, 2, this.materials.darkWood, x, y + 4, z - 10.8, 16).rotation.x = Math.PI / 2;
            this.collision.addObstacle(x, z, 14);
        }

        addLaundryLine(x, z, y) {
            this.addCylinder(0.6, 0.7, 8, this.materials.darkWood, x - 10, y + 4, z, 8);
            this.addCylinder(0.6, 0.7, 8, this.materials.darkWood, x + 10, y + 4, z, 8);
            const lineGeo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(x - 10, y + 7, z),
                new THREE.Vector3(x + 10, y + 7, z)
            ]);
            const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: P.darkWood }));
            this.scene.add(line);
            this.addBox(4, 3, 0.5, this.basicMaterial(P.roofBlue), x - 3, y + 5.4, z);
            this.addBox(4, 3, 0.5, this.basicMaterial(P.roofYellow), x + 4, y + 5.4, z);
        }

        addGardenPatch(x, z, y) {
            this.addBox(28, 0.4, 16, this.materials.grassDark, x, y + 0.25, z);
            for (let i = 0; i < 14; i++) {
                const px = x - 12 + this.rng() * 24;
                const pz = z - 6 + this.rng() * 12;
                this.addSphere(1.1, this.basicMaterial(this.rng() > 0.5 ? P.flowerPink : P.flowerBlue), px, y + 1.2, pz, 0.55);
            }
        }

        addQuayDetails() {
            this.addBox(172, 4, 8, this.materials.stone, 186, 2, 195);
            this.addBox(8, 4, 86, this.materials.stone, 104, 2, 154);
            this.addBox(8, 4, 86, this.materials.stone, 268, 2, 154);
            for (let i = 0; i < 5; i++) {
                this.addCylinder(2, 2.2, 6, this.materials.stoneDark, 118 + i * 34, 5.4, 194, 12);
            }
        }

        addDocks() {
            this.dockZones.forEach((zone) => {
                this.addBox(zone.w, 1.4, zone.d, this.materials.wood, zone.x, zone.h - 0.7, zone.z);
                const count = Math.max(3, Math.floor((zone.d + zone.w) / 22));
                for (let i = 0; i < count; i++) {
                    const t = count === 1 ? 0.5 : i / (count - 1);
                    const px = zone.x - zone.w / 2 + t * zone.w;
                    const pz = zone.z - zone.d / 2 + t * zone.d;
                    this.addCylinder(1.2, 1.4, 6, this.materials.darkWood, px, zone.h + 2.2, zone.z - zone.d / 2 + 3, 8);
                    this.addCylinder(1.2, 1.4, 6, this.materials.darkWood, zone.x + zone.w / 2 - 3, zone.h + 2.2, pz, 8);
                }
            });
        }

        addMerchantShip(x, z) {
            const y = C.waterLevel + 1.4;
            const group = new THREE.Group();
            group.position.set(x, y, z);
            const hull = new THREE.Mesh(new THREE.BoxGeometry(70, 12, 20), this.materials.darkWood);
            hull.position.y = 4;
            hull.scale.z = 0.86;
            group.add(hull);
            const deck = new THREE.Mesh(new THREE.BoxGeometry(58, 3, 16), this.materials.wood);
            deck.position.y = 11;
            group.add(deck);
            for (let i = -1; i <= 1; i += 2) {
                const bow = new THREE.Mesh(new THREE.ConeGeometry(11, 20, 4), this.materials.darkWood);
                bow.position.set(i * 40, 5, 0);
                bow.rotation.z = i > 0 ? -Math.PI / 2 : Math.PI / 2;
                bow.rotation.y = Math.PI / 4;
                group.add(bow);
            }
            for (let i = -1; i <= 1; i += 2) {
                const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 42, 10), this.materials.darkWood);
                mast.position.set(i * 16, 32, 0);
                group.add(mast);
                const sail = new THREE.Mesh(new THREE.BoxGeometry(2.2, 16, 18), this.materials.canvas);
                sail.position.set(i * 16, 33, 0);
                group.add(sail);
            }
            this.enableShadow(group);
            this.scene.add(group);
            this.collision.addObstacle(x, z, 34);
        }

        addSmallBoat(x, z, scale, rotY, playerBoat) {
            const group = new THREE.Group();
            const y = C.waterLevel + 0.25;
            group.position.set(x, y, z);
            group.rotation.y = rotY || 0;
            group.scale.setScalar(scale || 1);
            const hull = new THREE.Mesh(new THREE.BoxGeometry(12, 3, 24), this.materials.darkWood);
            hull.position.y = 1.6;
            group.add(hull);
            const deck = new THREE.Mesh(new THREE.BoxGeometry(9, 1, 18), this.materials.wood);
            deck.position.y = 3.7;
            group.add(deck);
            const bow = new THREE.Mesh(new THREE.ConeGeometry(6.4, 10, 4), this.materials.darkWood);
            bow.position.set(0, 2, 15);
            bow.rotation.x = Math.PI / 2;
            bow.rotation.y = Math.PI / 4;
            group.add(bow);
            const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 22, 8), this.materials.darkWood);
            mast.position.set(0, 14, -1);
            group.add(mast);
            const sailGeo = new THREE.BufferGeometry();
            sailGeo.setAttribute("position", new THREE.Float32BufferAttribute([
                0, 4, 0,
                0, 18, 0,
                9, 6, 0
            ], 3));
            sailGeo.setIndex([0, 1, 2]);
            sailGeo.computeVertexNormals();
            const sail = new THREE.Mesh(sailGeo, this.materials.canvas);
            sail.position.set(0, 2, -1.2);
            group.add(sail);
            this.enableShadow(group);
            this.scene.add(group);
            if (!playerBoat) this.collision.addObstacle(x, z, 8);
            return group;
        }

        addHarborWall() {
            this.addBox(180, 5, 5, this.materials.stone, 188, 4.8, 196);
            this.addBox(5, 5, 72, this.materials.stone, 104, 4.8, 160);
            this.addBox(5, 5, 72, this.materials.stone, 272, 4.8, 160);
        }

        addCrateCluster(x, z, y) {
            for (let i = 0; i < 7; i++) {
                const px = x + (this.rng() - 0.5) * 16;
                const pz = z + (this.rng() - 0.5) * 12;
                const s = 2.4 + this.rng() * 2.2;
                this.addBox(s, s, s, this.materials.wood, px, y + s / 2, pz, this.rng() * Math.PI);
                this.collision.addObstacle(px, pz, s * 0.6);
            }
        }

        addBarrels(x, z, y) {
            for (let i = 0; i < 6; i++) {
                const px = x + (this.rng() - 0.5) * 16;
                const pz = z + (this.rng() - 0.5) * 10;
                this.addCylinder(1.9, 2.1, 4, this.materials.darkWood, px, y + 2, pz, 10);
                this.collision.addObstacle(px, pz, 2.4);
            }
        }

        addFence(x1, z1, x2, z2, y) {
            const dx = x2 - x1;
            const dz = z2 - z1;
            const len = Math.sqrt(dx * dx + dz * dz);
            const angle = Math.atan2(dx, dz);
            const cx = (x1 + x2) / 2;
            const cz = (z1 + z2) / 2;
            this.addBox(2.2, 4.2, len, this.materials.wood, cx, y + 2.1, cz, angle);
            this.collision.addObstacleLine(x1, z1, x2, z2, 2.2);
        }

        addTree(x, z, scale, type, colorOverride) {
            const y = this.heightAt(x, z);
            const trunkMat = this.materials.darkWood;
            const leafMat = colorOverride ? this.basicMaterial(colorOverride) : (type === "pine" ? this.materials.forest : this.materials.grassDark);
            this.addCylinder(0.8 * scale, 1.1 * scale, 8 * scale, trunkMat, x, y + 4 * scale, z, 8);
            if (type === "pine") {
                for (let i = 0; i < 3; i++) {
                    this.addCone((5.2 - i * 1.1) * scale, 8 * scale, leafMat, x, y + (8 + i * 4.2) * scale, z, 9);
                }
            } else if (type === "ancient") {
                this.addSphere(7.2 * scale, leafMat, x, y + 11 * scale, z, 0.82);
                this.addSphere(5.2 * scale, leafMat, x - 4 * scale, y + 10 * scale, z + 2 * scale, 0.72);
                this.addSphere(5.2 * scale, leafMat, x + 4 * scale, y + 12 * scale, z - 2 * scale, 0.74);
            } else {
                this.addSphere(5.5 * scale, leafMat, x, y + 10 * scale, z, 0.82);
                this.addSphere(3.6 * scale, leafMat, x - 3 * scale, y + 9.2 * scale, z + 2 * scale, 0.82);
                this.addSphere(3.8 * scale, leafMat, x + 3.2 * scale, y + 10.4 * scale, z - 1.4 * scale, 0.82);
            }
            this.collision.addObstacle(x, z, 3.4 * scale);
        }

        addRock(x, z, scale) {
            const y = this.heightAt(x, z);
            const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(scale, 0), this.materials.cliffShade);
            mesh.position.set(x, y + scale * 0.5, z);
            mesh.rotation.set(this.rng() * Math.PI, this.rng() * Math.PI, this.rng() * Math.PI);
            mesh.scale.y = 0.62 + this.rng() * 0.5;
            this.enableShadow(mesh);
            this.scene.add(mesh);
            this.collision.addObstacle(x, z, scale * 1.1);
        }

        addStairs(x, z, width, steps, direction, fromH, toH) {
            const dz = direction === "south" ? 1 : direction === "north" ? -1 : 0;
            const dx = direction === "east" ? 1 : direction === "west" ? -1 : 0;
            const stepDepth = 5;
            for (let i = 0; i < steps; i++) {
                const t = steps === 1 ? 1 : i / (steps - 1);
                const h = fromH + (toH - fromH) * t;
                const sx = x + dx * stepDepth * i;
                const sz = z + dz * stepDepth * i;
                const w = dx ? stepDepth : width;
                const d = dz ? stepDepth : width;
                this.addBox(w, 1.1, d, this.materials.stone, sx, h + 0.55, sz);
            }
        }

        addClouds() {
            this.cloudGroup = new THREE.Group();
            const cloudMat = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                flatShading: true,
                roughness: 0.7,
                transparent: true,
                opacity: 0.86
            });
            for (let i = 0; i < 28; i++) {
                const cloud = new THREE.Group();
                const blocks = 3 + Math.floor(this.rng() * 4);
                for (let b = 0; b < blocks; b++) {
                    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), cloudMat);
                    mesh.position.set((this.rng() - 0.5) * 18, (this.rng() - 0.5) * 5, (this.rng() - 0.5) * 10);
                    const s = 7 + this.rng() * 12;
                    mesh.scale.set(s, s * 0.48, s * 0.72);
                    cloud.add(mesh);
                }
                cloud.position.set(-330 + this.rng() * 660, 116 + this.rng() * 52, -240 + this.rng() * 520);
                this.cloudGroup.add(cloud);
            }
            this.scene.add(this.cloudGroup);
        }
    }

    ns.MapEngine = MapEngine;
})();

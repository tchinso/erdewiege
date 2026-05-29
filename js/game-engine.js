(function () {
    const ns = window.RuruWorld = window.RuruWorld || {};
    const C = ns.Config;
    const P = ns.Palette;
    const Perf = ns.Perf;

    class GameEngine {
        constructor() {
            this.scene = null;
            this.camera = null;
            this.renderer = null;
            this.controls = null;
            this.mapCamera = null;
            this.clock = new THREE.Clock();
            this.ui = null;
            this.collision = null;
            this.world = null;
            this.player = null;
            this.viewportW = window.innerWidth;
            this.viewportH = window.innerHeight;
            this.baseDpr = Math.min(window.devicePixelRatio || 1, Perf.maxDpr);
            this.renderDpr = this.baseDpr;
            this.minRenderDpr = 0.75;
            this.minimapViewport = { x: 0, y: 0, w: 0, h: 0 };
            this.gameActive = false;
            this.lastFrameNow = 0;
            this.fpsSmoothed = 0;
            this.lastFpsHudNow = 0;
            this.lastScaleNow = 0;
            this.dragLook = false;
            this.lookYaw = 0;
            this.lookPitch = 0;
        }

        init() {
            this.ui = new ns.UIEngine();
            this.scene = new THREE.Scene();
            this.scene.background = P.sky;
            this.scene.fog = new THREE.Fog(P.sky, 120, C.viewDistance);

            this.camera = new THREE.PerspectiveCamera(64, this.viewportW / this.viewportH, 0.1, 1500);

            const fs = C.minimapCamSize;
            this.mapCamera = new THREE.OrthographicCamera(fs / -2, fs / 2, fs / 2, fs / -2, 1, 1200);
            this.mapCamera.up.set(0, 0, -1);

            this.renderer = new THREE.WebGLRenderer({
                antialias: Perf.antialias,
                alpha: false,
                powerPreference: "high-performance"
            });
            this.renderer.setPixelRatio(this.renderDpr);
            this.renderer.setSize(this.viewportW, this.viewportH);
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = Perf.shadowType;
            this.renderer.outputEncoding = THREE.sRGBEncoding;
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1.08;
            this.renderer.autoClear = false;
            document.body.appendChild(this.renderer.domElement);

            this.controls = new THREE.PointerLockControls(this.camera, document.body);
            this.setupControls();
            this.setupLights();

            this.collision = new ns.CollisionEngine(C);
            this.world = new ns.MapEngine(this.scene, this.collision).build();
            this.player = new ns.PlayerEngine(this.camera, this.controls, this.world, this.collision, this.ui);
            this.applyInitialSpawn();
            this.syncLookFromCamera();
            this.setupDragLook();

            this.updateMinimapViewportCache();
            window.addEventListener("resize", () => this.onResize());
            requestAnimationFrame((now) => this.animate(now));
        }

        setupControls() {
            this.ui.dom.startBtn.addEventListener("click", () => {
                this.startExploration();
            });

            this.controls.addEventListener("lock", () => {
                this.ui.hidePause();
                this.gameActive = true;
                this.clock.getDelta();
            });

            this.controls.addEventListener("unlock", () => {
                if (this.player && this.player.fallbackActive) return;
                if (!this.ui.dialogVisible) {
                    this.ui.showPause();
                }
                this.gameActive = false;
            });
        }

        startExploration() {
            this.startFallbackExploration();
        }

        startFallbackExploration() {
            if (this.player) this.player.setFallbackActive(true);
            this.ui.hidePause();
            this.gameActive = true;
            this.clock.getDelta();
        }

        canUsePointerLock() {
            if (!document.body || !document.body.requestPointerLock) return false;
            try {
                if (window.self !== window.top) return false;
            } catch (error) {
                return false;
            }
            return true;
        }

        applyInitialSpawn() {
            const params = new URLSearchParams(window.location.search);
            const spawn = (params.get("spawn") || "school").toLowerCase();
            const points = {
                school: { x: -166, z: -28, lookX: -166, lookZ: -158 },
                capital: { x: 158, z: -82, lookX: 158, lookZ: -226 },
                shopping: { x: -214, z: 54, lookX: -172, lookZ: 22 },
                residential: { x: 28, z: 110, lookX: 28, lookZ: 30 },
                port: { x: 178, z: 174, lookX: 184, lookZ: 236 }
            };

            if (spawn === "sea") {
                this.player.state.hasBoat = true;
                this.player.state.onBoat = true;
                this.player.state.boatDock = null;
                this.ui.setBoatStatus("승선 중");
                this.camera.position.set(266, C.waterLevel + C.boatEyeHeight, 286);
                this.camera.lookAt(204, C.waterLevel + C.boatEyeHeight - 1.2, 226);
                return;
            }

            const point = points[spawn] || points.school;
            this.player.placeAt(point.x, point.z);
            this.camera.lookAt(point.lookX, this.camera.position.y - 1.2, point.lookZ);
        }

        syncLookFromCamera() {
            this.camera.rotation.order = "YXZ";
            this.lookYaw = this.camera.rotation.y;
            this.lookPitch = this.camera.rotation.x;
        }

        setupDragLook() {
            const canvas = this.renderer.domElement;
            canvas.addEventListener("pointerdown", (event) => {
                if (!this.gameActive || this.ui.dialogVisible || this.controls.isLocked) return;
                this.dragLook = true;
                if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
            });

            window.addEventListener("pointerup", () => {
                this.dragLook = false;
            });

            window.addEventListener("pointermove", (event) => {
                if (!this.dragLook || this.controls.isLocked) return;
                this.lookYaw -= event.movementX * 0.003;
                this.lookPitch -= event.movementY * 0.003;
                this.lookPitch = ns.clamp(this.lookPitch, -1.05, 0.72);
                this.camera.rotation.set(this.lookPitch, this.lookYaw, 0, "YXZ");
            });

            window.addEventListener("keydown", (event) => {
                if (!this.gameActive || this.ui.dialogVisible || this.controls.isLocked) return;
                const turn = 0.08;
                if (event.code === "ArrowLeft") this.lookYaw += turn;
                if (event.code === "ArrowRight") this.lookYaw -= turn;
                if (event.code === "ArrowUp") this.lookPitch = ns.clamp(this.lookPitch - turn, -1.05, 0.72);
                if (event.code === "ArrowDown") this.lookPitch = ns.clamp(this.lookPitch + turn, -1.05, 0.72);
                this.camera.rotation.set(this.lookPitch, this.lookYaw, 0, "YXZ");
            });
        }

        setupLights() {
            const ambient = new THREE.AmbientLight(0xffffff, 0.72);
            this.scene.add(ambient);

            const hemi = new THREE.HemisphereLight(0xffffff, 0x7ab6c6, 0.52);
            hemi.position.set(0, 260, 0);
            this.scene.add(hemi);

            const sun = new THREE.DirectionalLight(0xffffff, 1.18);
            sun.position.set(-180, 330, 210);
            sun.castShadow = true;
            sun.shadow.mapSize.width = Perf.shadowMapSize;
            sun.shadow.mapSize.height = Perf.shadowMapSize;
            const d = 470;
            sun.shadow.camera.left = -d;
            sun.shadow.camera.right = d;
            sun.shadow.camera.top = d;
            sun.shadow.camera.bottom = -d;
            sun.shadow.camera.near = 1;
            sun.shadow.camera.far = 900;
            sun.shadow.bias = -0.00008;
            this.scene.add(sun);
        }

        updateMinimapViewportCache() {
            this.viewportW = window.innerWidth;
            this.viewportH = window.innerHeight;
            const rect = this.ui.dom.minimapContainer.getBoundingClientRect();
            this.minimapViewport.x = rect.left;
            this.minimapViewport.y = this.viewportH - rect.bottom;
            this.minimapViewport.w = rect.width;
            this.minimapViewport.h = rect.height;
        }

        onResize() {
            this.updateMinimapViewportCache();
            this.camera.aspect = this.viewportW / this.viewportH;
            this.camera.updateProjectionMatrix();
            this.baseDpr = Math.min(window.devicePixelRatio || 1, Perf.maxDpr);
            this.renderDpr = Math.min(this.renderDpr, this.baseDpr);
            this.applyRenderScale();
        }

        applyRenderScale() {
            this.renderer.setPixelRatio(this.renderDpr);
            this.renderer.setSize(this.viewportW, this.viewportH);
        }

        animate(now) {
            requestAnimationFrame((next) => this.animate(next));
            const dt = Math.min(this.clock.getDelta(), 0.05);
            const time = this.clock.getElapsedTime();

            this.updateFpsAndScale(now);
            this.ui.update(dt);

            if (this.gameActive) {
                this.player.update(dt);
            } else {
                this.player.updateHud();
            }

            this.world.updateAnimated(time, this.camera, this.player.state);
            this.render();
        }

        updateFpsAndScale(now) {
            if (!now) return;
            if (!this.lastFrameNow) {
                this.lastFrameNow = now;
                this.lastFpsHudNow = now;
                this.lastScaleNow = now;
                return;
            }

            const delta = now - this.lastFrameNow;
            this.lastFrameNow = now;
            if (delta <= 0) return;

            const fps = 1000 / delta;
            this.fpsSmoothed = this.fpsSmoothed ? this.fpsSmoothed * 0.9 + fps * 0.1 : fps;

            if (now - this.lastFpsHudNow >= 250) {
                this.ui.setFps(this.fpsSmoothed);
                this.lastFpsHudNow = now;
            }

            if (!this.gameActive) return;
            if (now - this.lastScaleNow < 1000) return;

            if (this.fpsSmoothed < 48 && this.renderDpr > this.minRenderDpr) {
                this.renderDpr = Math.max(this.minRenderDpr, Math.round((this.renderDpr - 0.1) * 100) / 100);
                this.applyRenderScale();
            } else if (this.fpsSmoothed > 58 && this.renderDpr < this.baseDpr) {
                this.renderDpr = Math.min(this.baseDpr, Math.round((this.renderDpr + 0.1) * 100) / 100);
                this.applyRenderScale();
            }
            this.lastScaleNow = now;
        }

        render() {
            this.renderer.setViewport(0, 0, this.viewportW, this.viewportH);
            this.renderer.setScissor(0, 0, this.viewportW, this.viewportH);
            this.renderer.setScissorTest(true);
            this.renderer.clear();
            this.renderer.render(this.scene, this.camera);

            this.renderer.setViewport(this.minimapViewport.x, this.minimapViewport.y, this.minimapViewport.w, this.minimapViewport.h);
            this.renderer.setScissor(this.minimapViewport.x, this.minimapViewport.y, this.minimapViewport.w, this.minimapViewport.h);
            this.renderer.clearDepth();

            this.mapCamera.position.set(this.camera.position.x, 280, this.camera.position.z);
            this.mapCamera.lookAt(this.camera.position.x, 0, this.camera.position.z);
            this.renderer.render(this.scene, this.mapCamera);
            this.renderer.setScissorTest(false);
        }
    }

    const game = new GameEngine();
    game.init();
})();

(function () {
    const ns = window.RuruWorld = window.RuruWorld || {};

    class UIEngine {
        constructor() {
            this.dom = {
                staminaBar: document.getElementById("stamina-bar"),
                location: document.getElementById("location-display"),
                pos: document.getElementById("pos-display"),
                gold: document.getElementById("gold-display"),
                boat: document.getElementById("boat-display"),
                minimapArrow: document.getElementById("minimap-arrow"),
                minimapContainer: document.getElementById("minimap-container"),
                fpsHud: document.getElementById("fps-hud"),
                pauseMenu: document.getElementById("pause-menu"),
                startBtn: document.getElementById("start-btn"),
                prompt: document.getElementById("interaction-prompt"),
                toast: document.getElementById("toast"),
                dialog: document.getElementById("dialog"),
                dialogTitle: document.getElementById("dialog-title"),
                dialogBody: document.getElementById("dialog-body"),
                dialogMenu: document.getElementById("dialog-menu")
            };

            this.toastTimer = 0;
            this.dialogVisible = false;
            this.lastStamina = -1;
            this.lastLocation = "";
            this.lastBoat = "";
        }

        setGold(value) {
            this.dom.gold.textContent = ns.formatGold(value);
        }

        setBoatStatus(text) {
            if (text === this.lastBoat) return;
            this.lastBoat = text;
            this.dom.boat.textContent = text;
        }

        setLocation(text) {
            if (text === this.lastLocation) return;
            this.lastLocation = text;
            this.dom.location.textContent = text;
        }

        setPosition(x, z) {
            this.dom.pos.textContent = `${Math.round(x)}, ${Math.round(z)}`;
        }

        setStamina(value) {
            const rounded = Math.round(value);
            if (rounded === this.lastStamina) return;
            this.lastStamina = rounded;
            this.dom.staminaBar.style.width = `${rounded}%`;
        }

        setFps(value) {
            this.dom.fpsHud.textContent = `${Math.round(value)} FPS`;
        }

        setDirection(angleRadians) {
            const deg = -angleRadians * (180 / Math.PI);
            this.dom.minimapArrow.style.transform = `translate(-50%, -50%) rotate(${deg}deg)`;
        }

        showInteraction(label) {
            if (this.dialogVisible) {
                this.hideInteraction();
                return;
            }
            this.dom.prompt.textContent = `E  ${label}`;
            this.dom.prompt.classList.add("visible");
        }

        hideInteraction() {
            this.dom.prompt.classList.remove("visible");
        }

        showToast(message, duration) {
            this.dom.toast.textContent = message;
            this.dom.toast.classList.add("visible");
            this.toastTimer = duration || 1.8;
        }

        update(dt) {
            if (this.toastTimer > 0) {
                this.toastTimer -= dt;
                if (this.toastTimer <= 0) {
                    this.dom.toast.classList.remove("visible");
                }
            }
        }

        showDialog(data) {
            this.dialogVisible = true;
            this.dom.dialogTitle.textContent = data.title || "장소";
            this.dom.dialogBody.textContent = data.body || "";
            this.dom.dialogMenu.innerHTML = "";

            const items = data.items || [];
            for (let i = 0; i < items.length; i++) {
                const li = document.createElement("li");
                li.textContent = items[i];
                this.dom.dialogMenu.appendChild(li);
            }

            this.dom.dialog.classList.add("visible");
            this.hideInteraction();
        }

        hideDialog() {
            this.dialogVisible = false;
            this.dom.dialog.classList.remove("visible");
        }

        showPause() {
            this.dom.pauseMenu.style.display = "flex";
            window.setTimeout(() => {
                this.dom.pauseMenu.style.opacity = 1;
            }, 10);
        }

        hidePause() {
            this.dom.pauseMenu.style.opacity = 0;
            window.setTimeout(() => {
                this.dom.pauseMenu.style.display = "none";
            }, 260);
        }
    }

    ns.UIEngine = UIEngine;
})();

(function () {
    const ns = window.RuruWorld = window.RuruWorld || {};

    class CollisionEngine {
        constructor(config) {
            this.config = config;
            this.cellSize = 18;
            this.gridOffset = 32768;
            this.gridMask = 0xffff;
            this.obstacleGrid = new Map();
            this.interactions = [];
        }

        reset() {
            this.obstacleGrid.clear();
            this.interactions.length = 0;
        }

        obstacleKey(ix, iz) {
            return (((ix + this.gridOffset) & this.gridMask) << 16) | ((iz + this.gridOffset) & this.gridMask);
        }

        addObstacle(x, z, radius, data) {
            const obs = { x, z, r: radius, data: data || null };
            const minX = Math.floor((x - radius) / this.cellSize);
            const maxX = Math.floor((x + radius) / this.cellSize);
            const minZ = Math.floor((z - radius) / this.cellSize);
            const maxZ = Math.floor((z + radius) / this.cellSize);

            for (let iz = minZ; iz <= maxZ; iz++) {
                for (let ix = minX; ix <= maxX; ix++) {
                    const key = this.obstacleKey(ix, iz);
                    let cell = this.obstacleGrid.get(key);
                    if (!cell) {
                        cell = [];
                        this.obstacleGrid.set(key, cell);
                    }
                    cell.push(obs);
                }
            }
        }

        addObstacleLine(x1, z1, x2, z2, radius, step) {
            const dx = x2 - x1;
            const dz = z2 - z1;
            const len = Math.sqrt(dx * dx + dz * dz);
            const count = Math.max(1, Math.ceil(len / (step || radius * 1.5)));

            for (let i = 0; i <= count; i++) {
                const t = i / count;
                this.addObstacle(x1 + dx * t, z1 + dz * t, radius);
            }
        }

        addInteraction(data) {
            this.interactions.push(data);
        }

        clampToBounds(pos) {
            const bounds = this.config.mapBounds;
            const beforeX = pos.x;
            const beforeZ = pos.z;
            pos.x = ns.clamp(pos.x, bounds.minX, bounds.maxX);
            pos.z = ns.clamp(pos.z, bounds.minZ, bounds.maxZ);
            return beforeX !== pos.x || beforeZ !== pos.z;
        }

        resolveObstacles(pos, playerRadius) {
            const cellX = Math.floor(pos.x / this.cellSize);
            const cellZ = Math.floor(pos.z / this.cellSize);
            let touched = false;

            for (let dz = -1; dz <= 1; dz++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const cell = this.obstacleGrid.get(this.obstacleKey(cellX + dx, cellZ + dz));
                    if (!cell) continue;

                    for (let i = 0; i < cell.length; i++) {
                        const obs = cell[i];
                        const ox = pos.x - obs.x;
                        const oz = pos.z - obs.z;
                        const minR = playerRadius + obs.r;
                        const distSq = ox * ox + oz * oz;

                        if (distSq < minR * minR) {
                            const dist = Math.sqrt(distSq);
                            if (dist < 0.0001) {
                                pos.x += minR;
                            } else {
                                const overlap = minR - dist;
                                pos.x += (ox / dist) * overlap;
                                pos.z += (oz / dist) * overlap;
                            }
                            touched = true;
                        }
                    }
                }
            }

            return touched;
        }

        nearestInteraction(pos, predicate) {
            let best = null;
            let bestScore = Infinity;

            for (let i = 0; i < this.interactions.length; i++) {
                const item = this.interactions[i];
                if (predicate && !predicate(item)) continue;

                const dx = pos.x - item.x;
                const dz = pos.z - item.z;
                const distSq = dx * dx + dz * dz;
                const radius = item.radius || 16;
                if (distSq > radius * radius) continue;

                const score = distSq / (radius * radius);
                if (score < bestScore) {
                    best = item;
                    bestScore = score;
                }
            }

            return best;
        }
    }

    ns.CollisionEngine = CollisionEngine;
})();

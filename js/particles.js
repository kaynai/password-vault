/* ============================================
   Krypton Vault — 粒子交互系统
   锁定界面鼠标互动粒子效果
   ============================================ */

(function () {
    const canvas = document.getElementById('particleCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // ---------- 配置 ----------
    const CONFIG = {
        particleCount: 90,
        baseRadius: 1.8,
        maxRadius: 4.5,
        connectionDist: 130,
        mouseRadius: 150,       // 鼠标斥力范围
        mouseForce: 0.06,       // 鼠标斥力强度
        clickBurstForce: 8,     // 点击爆发力
        speedLimit: 1.2,
        trailOpacity: 0.12,     // 拖尾透明度
        glowColor: '124,92,252',// 主色调 RGB
        glowColor2: '255,107,157',
        glowColor3: '0,212,170',
        fpsInterval: 1000 / 60,
    };

    // ---------- 状态 ----------
    let particles = [];
    let mouse = { x: -9999, y: -9999 };
    let isMouseOnCanvas = false;
    let width, height;
    let animFrame;
    let lastTime = 0;

    // ---------- 粒子类 ----------
    class Particle {
        constructor() {
            this.reset();
            // 初始随机散落位置
            this.x = Math.random() * width;
            this.y = Math.random() * height;
        }

        reset() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.vx = (Math.random() - 0.5) * CONFIG.speedLimit;
            this.vy = (Math.random() - 0.5) * CONFIG.speedLimit;
            this.radius = CONFIG.baseRadius + Math.random() * (CONFIG.maxRadius - CONFIG.baseRadius);
            this.baseRadius = this.radius;

            // 随机分配一种发光颜色
            const colors = [CONFIG.glowColor, CONFIG.glowColor2, CONFIG.glowColor3];
            this.color = colors[Math.floor(Math.random() * colors.length)];

            // 透明度浮动参数
            this.alphaPhase = Math.random() * Math.PI * 2;
            this.alphaSpeed = 0.008 + Math.random() * 0.015;
        }

        update() {
            // 鼠标交互 —— 斥力
            if (isMouseOnCanvas) {
                const dx = this.x - mouse.x;
                const dy = this.y - mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;

                if (dist < CONFIG.mouseRadius) {
                    const force = (1 - dist / CONFIG.mouseRadius) * CONFIG.mouseForce;
                    // 加入微小切向力，产生涡旋效果
                    const angle = Math.atan2(dy, dx);
                    const tangentialAngle = angle + Math.PI / 2;
                    this.vx += Math.cos(angle) * force * 1.5 + Math.cos(tangentialAngle) * force * 0.3;
                    this.vy += Math.sin(angle) * force * 1.5 + Math.sin(tangentialAngle) * force * 0.3;

                    // 靠近鼠标时微微放大
                    this.radius = this.baseRadius + (1 - dist / CONFIG.mouseRadius) * 3;
                } else {
                    this.radius += (this.baseRadius - this.radius) * 0.1;
                }
            } else {
                this.radius += (this.baseRadius - this.radius) * 0.1;
            }

            // 速度衰减
            this.vx *= 0.97;
            this.vy *= 0.97;

            // 更新位置
            this.x += this.vx;
            this.y += this.vy;

            // 边界回弹（柔和）
            const margin = 30;
            if (this.x < -margin) { this.x = width + margin; }
            if (this.x > width + margin) { this.x = -margin; }
            if (this.y < -margin) { this.y = height + margin; }
            if (this.y > height + margin) { this.y = -margin; }

            // 缓慢向中心区域漂移，避免粒子全部散开
            const cx = width / 2;
            const cy = height / 2;
            const driftForce = 0.00015;
            this.vx += (cx - this.x) * driftForce;
            this.vy += (cy - this.y) * driftForce;

            // 动态透明度
            this.alphaPhase += this.alphaSpeed;
        }

        draw(ctx) {
            const alpha = 0.5 + 0.3 * Math.sin(this.alphaPhase);
            const r = this.radius;

            // 外发光
            const glow = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r * 4);
            glow.addColorStop(0, `rgba(${this.color},${alpha})`);
            glow.addColorStop(0.4, `rgba(${this.color},${alpha * 0.5})`);
            glow.addColorStop(1, `rgba(${this.color},0)`);
            ctx.beginPath();
            ctx.arc(this.x, this.y, r * 4, 0, Math.PI * 2);
            ctx.fillStyle = glow;
            ctx.fill();

            // 核心白点
            ctx.beginPath();
            ctx.arc(this.x, this.y, r * 0.6, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${alpha * 0.9})`;
            ctx.fill();
        }
    }

    // ---------- 初始化粒子 ----------
    function initParticles() {
        particles = [];
        for (let i = 0; i < CONFIG.particleCount; i++) {
            particles.push(new Particle());
        }
    }

    // ---------- 画连接线 ----------
    function drawConnections() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const p1 = particles[i];
                const p2 = particles[j];
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < CONFIG.connectionDist) {
                    const opacity = (1 - dist / CONFIG.connectionDist) * 0.4;
                    const midX = (p1.x + p2.x) / 2;
                    const midY = (p1.y + p2.y) / 2;

                    // 渐变连线
                    const gradient = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
                    const c1 = p1.color;
                    const c2 = p2.color;
                    gradient.addColorStop(0, `rgba(${c1},${opacity})`);
                    gradient.addColorStop(0.5, `rgba(255,255,255,${opacity * 0.3})`);
                    gradient.addColorStop(1, `rgba(${c2},${opacity})`);

                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.strokeStyle = gradient;
                    ctx.lineWidth = 0.6;
                    ctx.stroke();
                }
            }
        }
    }

    // ---------- 鼠标连线 ----------
    function drawMouseConnections() {
        if (!isMouseOnCanvas) return;
        for (const p of particles) {
            const dx = p.x - mouse.x;
            const dy = p.y - mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < CONFIG.mouseRadius * 1.3) {
                const opacity = (1 - dist / (CONFIG.mouseRadius * 1.3)) * 0.5;
                ctx.beginPath();
                ctx.moveTo(mouse.x, mouse.y);
                ctx.lineTo(p.x, p.y);
                ctx.strokeStyle = `rgba(${p.color},${opacity})`;
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }
        }
    }

    // ---------- 鼠标光标光晕 ----------
    function drawMouseGlow() {
        if (!isMouseOnCanvas) return;
        const glow = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 60);
        glow.addColorStop(0, 'rgba(124,92,252,0.15)');
        glow.addColorStop(0.5, 'rgba(124,92,252,0.05)');
        glow.addColorStop(1, 'rgba(124,92,252,0)');
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 60, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
    }

    // ---------- 渲染循环 ----------
    function render(timestamp) {
        if (!lastTime) lastTime = timestamp;
        const elapsed = timestamp - lastTime;

        if (elapsed > CONFIG.fpsInterval) {
            lastTime = timestamp - (elapsed % CONFIG.fpsInterval);

            // 半透明覆盖实现拖尾效果
            ctx.fillStyle = `rgba(15,12,41,${CONFIG.trailOpacity})`;
            ctx.fillRect(0, 0, width, height);

            // 更新粒子
            for (const p of particles) {
                p.update();
            }

            // 绘制连接线（先画线再画点，点在线上层）
            drawConnections();
            drawMouseConnections();
            drawMouseGlow();

            // 绘制粒子
            for (const p of particles) {
                p.draw(ctx);
            }
        }

        animFrame = requestAnimationFrame(render);
    }

    // ---------- 窗口大小调整 ----------
    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }

    // ---------- 事件处理 ----------
    function onMouseMove(e) {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        isMouseOnCanvas = true;
    }

    function onMouseLeave() {
        isMouseOnCanvas = false;
    }

    function onMouseEnter(e) {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        isMouseOnCanvas = true;
    }

    function onClick(e) {
        // 点击爆发：以点击位置为中心，给所有粒子一个向外推力
        const cx = e.clientX;
        const cy = e.clientY;
        for (const p of particles) {
            const dx = p.x - cx;
            const dy = p.y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = Math.min(CONFIG.clickBurstForce / (dist * 0.01 + 1), 15);
            const angle = Math.atan2(dy, dx);
            p.vx += Math.cos(angle) * force;
            p.vy += Math.sin(angle) * force;
        }
    }

    // ---------- 触摸支持 ----------
    function onTouchMove(e) {
        if (e.touches.length > 0) {
            mouse.x = e.touches[0].clientX;
            mouse.y = e.touches[0].clientY;
            isMouseOnCanvas = true;
        }
    }

    function onTouchEnd() {
        isMouseOnCanvas = false;
    }

    // ---------- 启动 ----------
    function start() {
        resize();
        initParticles();

        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('mouseleave', onMouseLeave);
        canvas.addEventListener('mouseenter', onMouseEnter);
        canvas.addEventListener('click', onClick);
        canvas.addEventListener('touchmove', onTouchMove, { passive: true });
        canvas.addEventListener('touchend', onTouchEnd);

        window.addEventListener('resize', () => {
            resize();
        });

        animFrame = requestAnimationFrame(render);
    }

    // ---------- 停止（切换屏幕时调用） ----------
    function stop() {
        cancelAnimationFrame(animFrame);
        canvas.removeEventListener('mousemove', onMouseMove);
        canvas.removeEventListener('mouseleave', onMouseLeave);
        canvas.removeEventListener('mouseenter', onMouseEnter);
        canvas.removeEventListener('click', onClick);
        canvas.removeEventListener('touchmove', onTouchMove);
        canvas.removeEventListener('touchend', onTouchEnd);
        particles = [];
    }

    // ---------- 暴露 API 到全局 ----------
    window.particleSystem = {
        start,
        stop,
        canvas,
    };

    // 自动启动（锁定界面默认可见）
    if (document.getElementById('lockScreen').classList.contains('active')) {
        start();
    }

    // 监听屏幕切换
    const lockScreen = document.getElementById('lockScreen');
    if (lockScreen) {
        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.attributeName === 'class') {
                    if (lockScreen.classList.contains('active')) {
                        if (particles.length === 0) {
                            resize();
                            initParticles();
                            animFrame = requestAnimationFrame(render);
                        } else {
                            resize();
                        }
                    } else {
                        stop();
                    }
                }
            }
        });
        observer.observe(lockScreen, { attributes: true, attributeFilter: ['class'] });
    }

    console.log('%c✨ 粒子交互系统 %c已就绪',
        'font-size:1em;color:#c4b5fd;',
        'color:#aaa;');
})();

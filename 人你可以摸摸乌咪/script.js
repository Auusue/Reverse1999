const canvas = document.getElementById('fluidCanvas');
const ctx = canvas.getContext('2d');

let width, height;

// 动态调整 Canvas 大小
function resize() {
    width = canvas.parentElement.clientWidth;
    height = canvas.parentElement.clientHeight;
    canvas.width = width;
    canvas.height = height;
}
window.addEventListener('resize', resize);
resize();

// 鼠标/触摸位置对象（磁铁位置）
const mouse = { x: width / 2, y: height / 2, active: false };

// 监听互动事件
canvas.addEventListener('mousemove', (e) => {
    if (isCameraOn) return; // 🔴 如果开启了摄像头，屏蔽真实鼠标的输入
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    mouse.active = true;
});

canvas.addEventListener('mouseleave', () => {
    if (isCameraOn) return; // 🔴 屏蔽真实鼠标离开事件
    mouse.active = false;
});

canvas.addEventListener('touchmove', (e) => {
    if (isCameraOn) return;
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.touches[0].clientX - rect.left;
    mouse.y = e.touches[0].clientY - rect.top;
    mouse.active = true;
    e.preventDefault(); // 防止屏幕滚动
}, { passive: false });

canvas.addEventListener('touchend', () => {
    if (isCameraOn) return;
    mouse.active = false;
});

// --- 动画状态 ---
const animationState = {
    active: false,
    type: '', // 'exclamation' | 'spikeball' | 'catmouth'
    startTime: 0,
    duration: 2500 // 聚集并晃动 2.5 秒后散开
};

// 连击检测逻辑
let clickCount = 0;
let lastClickTime = 0;

canvas.addEventListener('click', () => {
    const now = Date.now();
    // 如果距离上次点击超过 1000ms，重置连击计数（放宽一点时间，让用户更容易连点3次）
    if (now - lastClickTime > 1000) {
        clickCount = 0;
    }
    clickCount++;
    lastClickTime = now;

    // 无论当前是否在播放动画，只要是第 3 次点击，就强制打断当前动画并播放猫猫嘴
    if (clickCount >= 3) {
        animationState.active = true;
        animationState.startTime = Date.now();
        animationState.type = 'catmouth';
        animationState.duration = 3000; // 展示 3 秒
        clickCount = 0; // 重置连击
    } 
    // 如果不是第 3 次点击，且当前没有动画在播放，则随机播放叹号或刺球
    else if (!animationState.active) {
        animationState.active = true;
        animationState.startTime = Date.now();
        
        // 50% 概率触发叹号，50% 概率触发刺球
        if (Math.random() < 0.5) {
            animationState.type = 'exclamation';
            animationState.duration = 2500;
        } else {
            animationState.type = 'spikeball';
            animationState.duration = 3000; 
        }
    }
});

// --- 物理粒子类 ---
class Particle {
    constructor() {
        // 初始位置随机分布
        this.x = Math.random() * width;
        this.y = height + Math.random() * 50; 
        this.vx = 0;
        this.vy = 0;
        // 粒子大小不一，融合起来的边缘会更像液体和磁流体
        // 🔴 将基础大小缩小（原来是 Math.random() * 10 + 12）
        this.radius = Math.random() * 8 + 8; 
        this.baseRadius = this.radius;
        this.mass = this.radius / 8;
        this.color = '#1a1a1a'; // 磁流体标志性的深黑色
    }

    update(index, total) {
        // 1. 重力：平时液体沉在底部，降低重力让液体看起来更轻盈细腻
        let gravity = 0.5 * this.mass;

        if (animationState.active) {
            const elapsed = Date.now() - animationState.startTime;
            if (elapsed > animationState.duration) {
                animationState.active = false;
            } else {
                let targetX = 0;
                let targetY = 0;

                if (animationState.type === 'exclamation') {
                    // ========================================
                    // 【叹号动画逻辑】
                    // ========================================
                    // 分配粒子：约 25% 作为下面的点，75% 作为上面的竖线
                    const dotCount = Math.max(1, Math.floor(total * 0.25));
                    const stickCount = total - dotCount;

                    if (index < dotCount) {
                        // 下面的点：让粒子在一个小圆范围内聚集
                        const dotRadius = 10; // 稍微缩小点的半径，让它更紧凑
                        const angle = (index / dotCount) * Math.PI * 2;
                        const r = Math.sqrt(index / dotCount) * dotRadius; 
                        targetX = Math.cos(angle) * r;
                        // 大幅往下移，拉开与竖线的间距，防止融合滤镜把它们黏在一起
                        targetY = 100 + Math.sin(angle) * r; 
                    } else {
                        // 上面的竖线：使用多个重叠的小圆堆叠成平滑的胶囊体棍子
                        const stickIndex = index - dotCount;
                        const t = stickCount > 1 ? stickIndex / (stickCount - 1) : 0.5;
                        // 让棍子中间稍微粗一点，两头稍微细一点
                        const widthOffset = Math.sin(t * Math.PI) * 8; 
                        // 左右交替排列，让边缘更丰满平滑
                        targetX = stickIndex % 2 === 0 ? widthOffset : -widthOffset;
                        // 整体往上提，给下方的点留出更多空间
                        targetY = -90 + t * 130; // 竖线底部在 40 左右，点在 100 左右，中间有足够大的断层
                    }

                    // 左右晃动动画（围绕底部的点摆动）
                    let angle = 0;
                    if (elapsed > 400) { // 前 400ms 先聚拢成形
                        // 随着时间衰减的晃动幅度
                        const damp = Math.max(0, 1 - (elapsed - 400) / (animationState.duration - 400));
                        angle = Math.sin((elapsed - 400) * 0.02) * 0.5 * damp; 
                    }

                    // 围绕底部 (0, 50) 旋转
                    const originY = 50;
                    const dyRot = targetY - originY;
                    const rotatedX = targetX * Math.cos(angle) - dyRot * Math.sin(angle);
                    const rotatedY = originY + targetX * Math.sin(angle) + dyRot * Math.cos(angle);
                    
                    targetX = rotatedX;
                    targetY = rotatedY;

                } else if (animationState.type === 'spikeball') {
                    // ========================================
                    // 【刺球动画逻辑】
                    // ========================================
                    const baseRadius = 25; // 缩小基础圆球的半径，让刺显得更长更突出
                    // 使用极坐标分配粒子
                    const numSpikes = 8; // 增加刺的数量
                    
                    let currentSpikeLength = 0;
                    if (elapsed > 200 && elapsed < 2000) {
                        // 刺的伸缩动画 (200ms~2000ms)
                        const t = (elapsed - 200) / 1800; 
                        // 用指数函数让刺长出来的过程更尖锐
                        currentSpikeLength = Math.sin(t * Math.PI) * 110; // 大幅增加刺的最大长度
                    }

                    // 1. 先决定当前粒子属于哪一根刺（或者是内核点）
                    // 将粒子分为两部分：30% 作为中心内核，70% 分配给刺
                    const coreCount = Math.floor(total * 0.3);
                    
                    if (index < coreCount) {
                        // 内核粒子：均匀分布在一个小圆内
                        const r = Math.sqrt(index / coreCount) * baseRadius;
                        const theta = index * 2.4; // 黄金角散布
                        targetX = Math.cos(theta) * r;
                        targetY = Math.sin(theta) * r;
                    } else {
                        // 刺粒子：均匀分配到各个刺上
                        const spikeParticles = total - coreCount;
                        const sIndex = index - coreCount; // 0 到 spikeParticles - 1
                        
                        // 计算当前粒子属于第几个刺 (0 到 numSpikes - 1)
                        const spikeId = sIndex % numSpikes;
                        // 计算该刺的基准角度
                        const baseAngle = (spikeId / numSpikes) * Math.PI * 2;
                        
                        // 计算该粒子在刺上的位置 (0.0 = 根部, 1.0 = 尖端)
                        const positionOnSpike = Math.floor(sIndex / numSpikes) / Math.floor(spikeParticles / numSpikes);
                        
                        // 核心：把线性的排布变成“水滴/尖刺”的形状
                        // 使用指数让靠近尖端的粒子变少，靠近根部的粒子变多，形成锥形
                        const r = baseRadius + Math.pow(positionOnSpike, 1.5) * currentSpikeLength;
                        
                        // 给刺增加一点随机的宽度，让它像液体一样边缘不规则，而不是一条死板的直线
                        // 越靠近根部越宽，越靠近尖端越细
                        const spikeWidth = (1 - positionOnSpike) * 15;
                        // 左右偏移
                        const offsetAngle = (sIndex % 2 === 0 ? 1 : -1) * (spikeWidth / r);
                        
                        const finalAngle = baseAngle + offsetAngle;
                        targetX = Math.cos(finalAngle) * r;
                        targetY = Math.sin(finalAngle) * r;
                    }

                    // 增加整体旋转效果，让刺球在变形时有强烈的动态感
                    const rotation = elapsed * 0.005; // 稍微加快一点旋转速度
                    
                    const rotatedX = targetX * Math.cos(rotation) - targetY * Math.sin(rotation);
                    const rotatedY = targetX * Math.sin(rotation) + targetY * Math.cos(rotation);
                    
                    targetX = rotatedX;
                    targetY = rotatedY;
                    
                    // 让整个刺球稍微往上悬浮在空中
                    targetY -= 20;
                    
                    // 加入一点呼吸起伏的浮动感
                    targetY += Math.sin(elapsed * 0.005) * 8;
                } else if (animationState.type === 'catmouth') {
                    // ========================================
                    // 【猫猫嘴动画逻辑】
                    // 放弃复杂的物理模拟和宽度排布，直接强制排成一条极细、平滑的曲线
                    // 形状：标准的 'w' 或者说是 ':3' 的嘴巴
                    // ========================================
                    
                    // 🔴 强制限制猫猫嘴的最大使用粒子数
                    // 无论用户在设置里加了多少液量，猫猫嘴最多只用 12 个粒子去画线
                    // 如果液量本来就少（比如只有 5 个），就用 5 个；否则封顶 12 个，保证极细的线条感
                    const maxMouthParticles = Math.min(total, 12);
                    
                    if (index < maxMouthParticles) {
                        // 参与画嘴巴的粒子
                        const t = maxMouthParticles > 1 ? index / (maxMouthParticles - 1) : 0.5; // 0 到 1 线性分布
                        
                        // 整体宽度，稍微窄一点显得可爱
                        const mouthWidth = 80; 
                        const startX = -mouthWidth / 2;
                        
                        // 1. X 坐标：直接线性从左到右排布
                        targetX = startX + t * mouthWidth;
                        
                        // 2. Y 坐标：使用两个圆弧拼接，模拟猫嘴 w 形状
                        let baseY = 0;
                        if (t < 0.5) {
                            // 左边的 U 形：(x - 0.25)^2 的抛物线/圆弧形状
                            const localT = (t - 0.25) * 4; // 映射到 -1 到 1
                            // Y 轴向下的情况下：我们要中间下垂(正值)，两端上扬(负值)或靠近 0
                            // 当 localT = 0 (即 t=0.25 谷底) 时，希望 y 最大(最靠下)
                            // 当 localT = 1 或 -1 (即 t=0 或 t=0.5 顶点) 时，希望 y 最小(最靠上)
                            baseY = (localT * localT) * -20 + 20; 
                        } else {
                            // 右边的 U 形：(x - 0.75)^2
                            const localT = (t - 0.75) * 4; // 映射到 -1 到 1
                            baseY = (localT * localT) * -20 + 20;
                        }
                        
                        // 让曲线整体往下移动，调整猫猫嘴在脸上的垂直位置
                        targetY = baseY + 20; // 改为 +20，往下移动
                        
                        // 3. 强制消除所有的 offset、粗细变化、散布
                        // 因为放弃了体积感，所以让所有的粒子仅仅是首尾相连形成一条线
                        
                        // 加入一点整体的 Q 弹晃动动画，增加趣味性
                        const bounce = Math.sin(elapsed * 0.015) * Math.exp(-elapsed * 0.003) * 15;
                        targetY += bounce;
                    } else {
                        // 🔴 多余的粒子：全部藏在嘴巴下面，避免影响细线造型
                        // 把它们藏在中间的 W 尖角下面，作为一点点阴影或下巴
                        targetX = 0;
                        targetY = 40; 
                        
                        // 如果多余的粒子太多，让它们在下巴区域稍微散开一点
                        const extraIndex = index - maxMouthParticles;
                        const angle = extraIndex * 2.4;
                        const r = Math.sqrt(extraIndex) * 2;
                        targetX += Math.cos(angle) * r;
                        targetY += Math.sin(angle) * r;
                        
                        // 也带上跳动效果
                        const bounce = Math.sin(elapsed * 0.015) * Math.exp(-elapsed * 0.003) * 15;
                        targetY += bounce;
                    }
                }

                // 计算全局目标位置
                const globalTargetX = width / 2 + targetX;
                const globalTargetY = height / 2 + targetY;

                // 强大的吸引力拉向目标位置，并增加阻尼让形状更稳定
                const dx = globalTargetX - this.x;
                const dy = globalTargetY - this.y;

                // 施加向心力
                this.vx += dx * 0.1;
                this.vy += dy * 0.1;

                // 动画模式下抵消重力，并增加极强的阻尼让它们不要互相排斥乱窜
                gravity = 0;
                this.vx *= 0.65;
                this.vy *= 0.65;
            }
        } else if (!mouse.active) {
            // ========================================
            // 【待机模式：横杠+小圆点】
            // 模仿参考图中的形状：一根扁平的横杠，中间偏下凹陷，右侧带一个小圆点
            // ========================================
            const elapsed = Date.now();
            let targetX = 0;
            let targetY = 0;
            
            // 🔴 待机表情的整体位置调整
            // 修改这里可以移动整个待机表情的位置（0,0 是缸的中心）
            const idleOffsetX = 0;
            const idleOffsetY = 40; // 从 20 往下移动 10px，变成 30
            
            // 缩放比例
            const idleScale = 0.8;
            
            // 将粒子分为两部分：右侧的小圆点 (约 5%) 和 主体横杠 (约 95%)
            const dotCount = Math.max(1, Math.floor(total * 0.05));
            const barCount = total - dotCount;

            if (index < dotCount) {
                // 小圆点：在主体右上方聚集
                // 根据粒子数量动态调整点的半径
                const densityFactor = Math.min(1.0, dotCount / 6); // 假设点分配到 6 个粒子是满状态
                const dotRadius = 4 * densityFactor;
                const angle = (index / dotCount) * Math.PI * 2;
                const r = Math.sqrt(index / dotCount) * dotRadius;
                // 让圆点的位置带有轻微的呼吸浮动
                const floatY = Math.sin(elapsed * 0.002) * 2;
                
                targetX = (100 + Math.cos(angle) * r) * idleScale + idleOffsetX;
                targetY = (-30 + Math.sin(angle) * r + floatY) * idleScale + idleOffsetY;
            } else {
                // 主体：一个长条形的水滴，左边宽，中间极窄，右边宽
                const barIndex = index - dotCount;
                // 将横杠粒子分成 5 排：中心 1 排，上下各 2 排
                // 更密集的排布可以产生几乎完美的平滑边缘
                const row = barIndex % 5; 
                const tIndex = Math.floor(barIndex / 5);
                const tCount = Math.ceil(barCount / 5);
                const t = tCount > 1 ? tIndex / (tCount - 1) : 0.5; // 0 到 1
                
                // 线条的起点和终点坐标 (从左到右)
                const startX = -100;
                const endX = 110;
                
                // 🔴 动态调整宽度：当粒子数量太少时，强行压缩表情的宽度和长度
                // 这样能保证即使只有十几二十个粒子，它们也能紧凑地贴在一起，而不是散成一排断开的珠子
                const densityFactor = Math.min(1.0, barCount / 40); // 假设 40 个粒子是标准密度
                
                // 粒子很少时，强行缩短两端的距离，让粒子集中在中间，避免被拉成虚线
                const currentStartX = startX * densityFactor;
                const currentEndX = endX * densityFactor;
                
                // 线性插值计算 X 坐标
                const baseX = currentStartX + t * (currentEndX - currentStartX);
                
                // 计算 Y 坐标 (中间下凹，模拟波浪形)
                let baseY = 0;
                if (t < 0.5) {
                    baseY = Math.sin(t * Math.PI) * 15; // 左边到中间往下弯
                } else {
                    baseY = 15 - Math.sin((t - 0.5) * Math.PI) * 10; // 中间到右边稍微往上收一点
                }
                
                // 使用多项式结合，模拟图片里的不规则宽度
                let barWidth = 15;
                if (t < 0.4) {
                    barWidth = 18 * Math.sin((t / 0.4) * Math.PI);
                } else if (t < 0.7) {
                    barWidth = 4 + 2 * Math.sin(((t - 0.4) / 0.3) * Math.PI); // 中间极细
                } else {
                    barWidth = 16 * Math.sin(((t - 0.7) / 0.3) * Math.PI);
                }
                
                barWidth *= densityFactor; // 粒子越少，横杠越细

                // 根据所在行数计算偏移量 (内层填补，外层撑开边缘)
                let offset = 0;
                if (row === 1) offset = barWidth;           // 最上边缘
                else if (row === 2) offset = -barWidth;     // 最下边缘
                else if (row === 3) offset = barWidth * 0.5;  // 内部偏上
                else if (row === 4) offset = -barWidth * 0.5; // 内部偏下
                // row === 0 留在中心骨架
                
                // 加上一点整体的缓慢呼吸动画
                const floatY = Math.sin(elapsed * 0.002 + t * Math.PI) * 3;

                targetX = (baseX) * idleScale + idleOffsetX;
                targetY = (baseY + offset + floatY) * idleScale + idleOffsetY;
            }

            // 计算全局目标位置
            const globalTargetX = width / 2 + targetX;
            const globalTargetY = height / 2 + targetY;

                // 吸引力拉向目标位置
                const dx = globalTargetX - this.x;
                const dy = globalTargetY - this.y;

                // 施加向心力 (极大增加向心力，强行把粒子锁死在指定位置)
            this.vx += dx * 0.15;
            this.vy += dy * 0.15;

            // 待机模式下抵消重力，并增加极致阻尼，消除一切抖动
            gravity = 0;
            this.vx *= 0.45;
            this.vy *= 0.45;
        }

        this.vy += gravity;

        // 2. 磁铁吸引力：如果鼠标激活，产生向上的引力 (动画模式时暂停吸引)
        if (mouse.active && !animationState.active) {
            const dx = mouse.x - this.x;
            const dy = mouse.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // 磁力影响范围
            if (dist < 200) {
                // 距离越近，引力越大。稍微增加引力灵敏度，让小颗粒更容易被吸起
                const force = (200 - dist) / 200;
                this.vx += (dx / dist) * force * 3.5;
                this.vy += (dy / dist) * force * 3.5;
            }
        }

        // 3. 摩擦力与流体粘性：稍微降低摩擦，让小颗粒运动更丝滑、细节更多
        this.vx *= 0.90;
        this.vy *= 0.90;

        this.x += this.vx;
        this.y += this.vy;

        // 4. 边界碰撞检测（物理上限制在圆形内，减去边缘厚度使其不超出底图内壁）
        const centerX = width / 2;
        const centerY = height / 2;
        // 🔴 如果你调整了整体大小，这里 `- 10` (边缘厚度) 可能需要微调，以匹配底图的黑色内壁
        const radiusTank = width / 2 - 10; 
        
        const dxCenter = this.x - centerX;
        const dyCenter = this.y - centerY;
        const distFromCenter = Math.sqrt(dxCenter * dxCenter + dyCenter * dyCenter);
        
        // 如果粒子碰到了缸壁
        if (distFromCenter + this.radius > radiusTank) {
            const angle = Math.atan2(dyCenter, dxCenter);
            
            // 强制拉回缸内
            this.x = centerX + Math.cos(angle) * (radiusTank - this.radius);
            this.y = centerY + Math.sin(angle) * (radiusTank - this.radius);
            
            // 简单的反弹计算
            const normalX = Math.cos(angle);
            const normalY = Math.sin(angle);
            const dotProduct = this.vx * normalX + this.vy * normalY;
            
            this.vx -= 1.5 * dotProduct * normalX;
            this.vy -= 1.5 * dotProduct * normalY;
            
            // 撞击缸壁时的能量损耗
            this.vx *= 0.7;
            this.vy *= 0.7;
        }
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
    }
}

// 初始化粒子群
const particles = [];
// 🔴 初始液量
let particleCount = 25; 
for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
}

// --- 控制面板逻辑 ---
const toggleBtn = document.getElementById('toggle-panel');
const panelContent = document.getElementById('panel-content');
const particleSlider = document.getElementById('particleSlider');
const particleValue = document.getElementById('particleValue');

// 1. 展开/收起面板
toggleBtn.addEventListener('click', () => {
    panelContent.classList.toggle('collapsed');
});

// 2. 监听滑块拖动，动态调整液量
particleSlider.addEventListener('input', (e) => {
    const newCount = parseInt(e.target.value, 10);
    particleValue.textContent = newCount;
    
    // 如果滑块的值大于当前粒子数，添加新粒子
    if (newCount > particles.length) {
        const diff = newCount - particles.length;
        for (let i = 0; i < diff; i++) {
            particles.push(new Particle());
        }
    } 
    // 如果滑块的值小于当前粒子数，删除多余的粒子
    else if (newCount < particles.length) {
        // splice 会直接修改原数组，保留前 newCount 个元素
        particles.splice(newCount);
    }
});

// 处理粒子之间的互相排斥（保持流体的体积感，不会全部缩成一个点）
function resolveCollisions() {
    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            const p1 = particles[i];
            const p2 = particles[j];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = p1.radius + p2.radius;

            // 如果两个粒子重叠了
            if (dist < minDist) {
                const angle = Math.atan2(dy, dx);
                const overlap = minDist - dist;
                
                // 给彼此施加推力
                let force = overlap * 0.15;
                
                // 动画模式下，减弱粒子间的互相排斥，让它们能更紧密地抱团形成平滑形状
                if (animationState.active) {
                    force = overlap * 0.02;
                } else if (!mouse.active) {
                    // 待机模式下彻底关闭排斥力，防止粒子互相推挤导致边缘产生锯齿
                    force = 0;
                }

            const fx = Math.cos(angle) * force;
            const fy = Math.sin(angle) * force;

            p1.vx -= fx;
            p1.vy -= fy;
            p2.vx += fx;
            p2.vy += fy;
            }
        }
    }
}

// 动画主循环
function animate() {
    // 每次渲染前清空画布
    ctx.clearRect(0, 0, width, height);

    // 计算粒子碰撞
    resolveCollisions();

    // 更新和绘制每个粒子
    for (let i = 0; i < particles.length; i++) {
        particles[i].update(i, particles.length);
        particles[i].draw();
    }

    requestAnimationFrame(animate);
}

// 启动动画
animate();

// ========================================
// 【摄像头手势骨骼追踪交互逻辑】
// 使用 MediaPipe Hands 进行食指骨骼节点追踪
// ========================================
const videoElement = document.getElementById('inputVideo');
const toggleCameraBtn = document.getElementById('toggleCameraBtn');
const handCursor = document.getElementById('handCursor');

let hands = null;
let isCameraOn = false;
let lastHandTime = 0; // 记录最后一次检测到手的时间

async function initHandTracking() {
    toggleCameraBtn.textContent = '请求摄像头权限...';
    toggleCameraBtn.disabled = true;

    try {
        // 1. 原生获取摄像头画面
        // 必须在 localhost 或者 https 下运行，否则浏览器会拦截
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480 } 
        });
        videoElement.srcObject = stream;
        
        await new Promise(resolve => {
            videoElement.onloadedmetadata = () => {
                videoElement.play();
                resolve();
            };
        });

        toggleCameraBtn.textContent = '加载骨骼模型...';

        // 2. 初始化手部骨骼追踪模型
        hands = new Hands({locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }});
        
        hands.setOptions({
            maxNumHands: 1, // 只追踪一只手
            modelComplexity: 1, // 模型复杂度
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        hands.onResults(onHandResults);

        // 3. 循环将摄像头画面喂给骨骼模型
        async function sendFrame() {
            if (isCameraOn && videoElement.readyState >= 2) {
                try {
                    await hands.send({image: videoElement});
                } catch (err) {
                    console.error("手势识别错误:", err);
                }
            }
            if (isCameraOn) {
                requestAnimationFrame(sendFrame);
            }
        }
        
        isCameraOn = true;
        sendFrame();

        toggleCameraBtn.disabled = false;
        return true;
    } catch (error) {
        console.error("初始化失败:", error);
        alert("无法获取摄像头！\n\n原因：浏览器安全限制。\n出于隐私保护，浏览器不允许直接双击打开的本地文件 (file://) 使用摄像头。\n\n请看右侧我已经为您启动了一个本地服务器 (http://localhost)，请在那个新页面里点击开启！");
        toggleCameraBtn.textContent = '📷 开启手势互动';
        toggleCameraBtn.disabled = false;
        isCameraOn = false;
        return false;
    }
}

function onHandResults(results) {
    if (!isCameraOn) return;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        // 骨骼节点 8 是食指指尖 (Index Finger Tip)
        const indexFinger = landmarks[8];
        
        // 摄像头画面是镜像的，所以 X 坐标需要反转 (1 - x)
        // 将归一化的坐标 (0~1) 映射到屏幕的宽高
        const screenX = (1 - indexFinger.x) * window.innerWidth;
        const screenY = indexFinger.y * window.innerHeight;
        
        // 🔴 更新虚拟光标位置，给用户视觉反馈
        handCursor.style.left = `${screenX}px`;
        handCursor.style.top = `${screenY}px`;
        handCursor.classList.add('visible');
        
        // 转换为相对于 Canvas 的坐标
        const rect = canvas.getBoundingClientRect();
        mouse.x = screenX - rect.left;
        mouse.y = screenY - rect.top;
        mouse.active = true;
        
        lastHandTime = Date.now();
    } else {
        // 如果超过 500ms 没检测到手，就让它进入待机表情
        if (Date.now() - lastHandTime > 500) {
            mouse.active = false;
            handCursor.classList.remove('visible'); // 隐藏光标
        }
    }
}

toggleCameraBtn.addEventListener('click', async () => {
    if (!isCameraOn) {
        if (!hands) {
            const success = await initHandTracking();
            if (!success) return;
        } else {
            // 重新开启摄像头
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
                videoElement.srcObject = stream;
                videoElement.play();
                isCameraOn = true;
                
                async function sendFrame() {
                    if (isCameraOn && videoElement.readyState >= 2) {
                        try {
                            await hands.send({image: videoElement});
                        } catch (err) {}
                    }
                    if (isCameraOn) {
                        requestAnimationFrame(sendFrame);
                    }
                }
                sendFrame();
            } catch (err) {
                alert("获取摄像头失败！请确保允许了权限。");
                return;
            }
        }
        
        videoElement.style.display = 'block';
        toggleCameraBtn.textContent = '⏹️ 关闭手势互动';
        toggleCameraBtn.classList.add('active');
    } else {
        // 彻底关闭摄像头，释放硬件资源
        const stream = videoElement.srcObject;
        if (stream) {
            const tracks = stream.getTracks();
            tracks.forEach(track => track.stop());
        }
        videoElement.srcObject = null;
        
        videoElement.style.display = 'none';
        toggleCameraBtn.textContent = '📷 开启手势互动';
        toggleCameraBtn.classList.remove('active');
        isCameraOn = false;
        mouse.active = false; // 马上进入待机
        handCursor.classList.remove('visible'); // 隐藏光标
    }
});

// ========================================
// 【移动端访问二维码生成】
// ========================================
const mobileAccessInfo = document.getElementById('mobileAccessInfo');
const currentHostname = window.location.hostname;

// 根据之前在终端查询到的电脑局域网 IP
const knownLanIp = '192.168.200.196';
const port = window.location.port || '8000';

if (currentHostname === 'localhost' || currentHostname === '127.0.0.1' || currentHostname === '') {
    // 如果用户是在 localhost 下访问的，提示他们切换到局域网 IP
    mobileAccessInfo.innerHTML = `
        <p style="color: #e65100; margin-bottom: 8px;">请用局域网 IP 访问以生成二维码</p>
        <p style="margin-bottom: 5px;">点击下方链接重新打开：</p>
        <a href="http://${knownLanIp}:${port}" style="color: #4caf50; font-weight: bold; text-decoration: none; display: inline-block; padding: 5px 10px; border: 1px solid #4caf50; border-radius: 5px; background: #e8f5e9;">http://${knownLanIp}:${port}</a>
    `;
} else {
    // 如果用户已经在使用 IP 访问，直接调用 API 生成当前网址的二维码
    const currentUrl = window.location.href;
    mobileAccessInfo.innerHTML = `
        <p style="margin-bottom: 8px;">手机连接同Wi-Fi后扫码</p>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(currentUrl)}" alt="二维码" style="border-radius: 8px; width: 120px; height: 120px; border: 1px solid #eee; padding: 5px;">
        <p style="margin-top: 8px; word-break: break-all; font-size: 11px;">
            <a href="${currentUrl}" style="color: #4caf50; text-decoration: none;">${currentUrl}</a>
        </p>
    `;
}
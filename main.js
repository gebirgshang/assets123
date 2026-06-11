// ==========================================
// LAYER ZERO - IDLE 3D PRINTER SIMULATOR
// ==========================================

const config = {
    type: Phaser.AUTO,
    width: 1080,
    height: 1920,
    backgroundColor: '#1a1a2e',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

// --- Game State & Data ---
let saveData = {
    cash: 0,
    speedLevel: 1,
    profitLevel: 1,
    coolingLevel: 1
};

// Costs
let getSpeedCost = () => Math.floor(10 * Math.pow(1.5, saveData.speedLevel - 1));
let getProfitCost = () => Math.floor(15 * Math.pow(1.6, saveData.profitLevel - 1));

// Printer variables
let currentLayer = 0;
let totalLayers = 100;
let extruderDirection = 1; // 1 for right, -1 for left
let isPrinting = true;

// Sprites & UI
let cashText;
let extruder;
let bed;
let printObject;
let printMask;
let graphicsMask;
let btnSpeed, btnProfit, btnSpeedText, btnProfitText;
let progressText;

// ==========================================
// PRELOAD ASSETS
// ==========================================
function preload() {
    // HOW TO USE YOUR GITHUB ASSETS:
    // Delete the "Fallback Textures" block below, and uncomment these lines,
    // replacing the file paths with the exact names from your ZIP files.
    
    // this.load.image('bed', 'assets/printer_bed.png');
    // this.load.image('extruder', 'assets/extruder_head.png');
    // this.load.image('model', 'assets/printed_object.png');
    
    // --- Fallback Textures (So the game runs instantly without your assets yet) ---
    let g = this.add.graphics();
    g.fillStyle(0x333344); g.fillRect(0, 0, 800, 60); g.generateTexture('bed', 800, 60); g.clear();
    g.fillStyle(0xe94560); g.fillRect(0, 0, 80, 120); g.generateTexture('extruder', 80, 120); g.clear();
    g.fillStyle(0x0f3460); g.fillCircle(250, 250, 250); g.generateTexture('model', 500, 500); g.destroy();
    // ------------------------------------------------------------------------------
}

// ==========================================
// CREATE (SCENE SETUP)
// ==========================================
function create() {
    // 1. Load Save Data (if exists)
    let saved = localStorage.getItem('layerZeroSave');
    if (saved) saveData = JSON.parse(saved);

    // 2. Setup Printer Environment
    const centerX = this.scale.width / 2;
    
    // Printer Bed
    bed = this.add.image(centerX, 1300, 'bed');

    // The Object being printed (Anchored at the bottom)
    printObject = this.add.image(centerX, bed.y - (bed.height / 2), 'model').setOrigin(0.5, 1);

    // The Dynamic Mask (This is the magic that simulates layer-by-layer printing)
    graphicsMask = this.make.graphics();
    printMask = new Phaser.Display.Masks.GeometryMask(this, graphicsMask);
    printObject.setMask(printMask);
    updateMask(); // Initial mask setup

    // Extruder Head
    extruder = this.add.image(centerX, printObject.y - printObject.height, 'extruder').setOrigin(0.5, 1);

    // 3. UI Setup
    // Top Bar (Cash & Title)
    let topBar = this.add.graphics();
    topBar.fillStyle(0x16213e);
    topBar.fillRect(0, 0, this.scale.width, 250);

    this.add.text(centerX, 80, 'LAYER ZERO', { fontSize: '48px', fontFamily: 'Impact, sans-serif', color: '#e94560', fontStyle: 'bold' }).setOrigin(0.5);
    cashText = this.add.text(centerX, 160, formatMoney(saveData.cash), { fontSize: '72px', fontFamily: 'Arial', color: '#4ecca3', fontStyle: 'bold' }).setOrigin(0.5);

    progressText = this.add.text(centerX, 300, 'Print Progress: 0%', { fontSize: '42px', color: '#ffffff' }).setOrigin(0.5);

    // 4. Upgrade Buttons (Bottom of screen)
    setupUpgradeButtons(this);
    
    // Auto-save loop
    this.time.addEvent({ delay: 5000, callback: () => localStorage.setItem('layerZeroSave', JSON.stringify(saveData)), loop: true });
}

// ==========================================
// MAIN IDLE LOOP
// ==========================================
function update(time, delta) {
    if (!isPrinting) return;

    // Extruder Speed Calculation (Base speed + Upgrade level)
    let moveSpeed = (200 + (saveData.speedLevel * 80)) * (delta / 1000); 
    
    // Move extruder back and forth
    extruder.x += moveSpeed * extruderDirection;
    
    // Printer Boundaries
    let leftBound = bed.x - (bed.width / 2) + 50;
    let rightBound = bed.x + (bed.width / 2) - 50;

    // Check if a pass is complete (hits the edge)
    if (extruder.x > rightBound) {
        extruder.x = rightBound;
        extruderDirection = -1;
        completeLayer(this);
    } else if (extruder.x < leftBound) {
        extruder.x = leftBound;
        extruderDirection = 1;
        completeLayer(this);
    }
}

// ==========================================
// GAMEPLAY MECHANICS
// ==========================================
function completeLayer(scene) {
    currentLayer++;

    // Calculate Earnings
    let earnings = 1.5 * Math.pow(1.2, saveData.profitLevel - 1);
    saveData.cash += earnings;

    // Update UI
    cashText.setText(formatMoney(saveData.cash));
    progressText.setText('Print Progress: ' + Math.floor((currentLayer / totalLayers) * 100) + '%');
    
    // Pop up text
    spawnFloatingText(scene, extruder.x, extruder.y - 50, '+' + formatMoney(earnings));
    
    // Move extruder UP and adjust the visual mask
    updateMask();
    extruder.y = printObject.y - (printObject.height * (currentLayer / totalLayers));

    // Check if object is finished
    if (currentLayer >= totalLayers) {
        finishPrint(scene);
    }
}

function finishPrint(scene) {
    isPrinting = false;
    
    // Big completion bonus
    let completionBonus = (1.5 * Math.pow(1.2, saveData.profitLevel - 1)) * 50;
    saveData.cash += completionBonus;
    cashText.setText(formatMoney(saveData.cash));
    spawnFloatingText(scene, bed.x, bed.y - 200, 'PRINT COMPLETE!\n+' + formatMoney(completionBonus), '#e94560', 60);

    // Reset for next print after a short cooldown
    scene.time.delayedCall(1500, () => {
        currentLayer = 0;
        extruder.y = printObject.y;
        updateMask();
        progressText.setText('Print Progress: 0%');
        isPrinting = true;
    });
}

function updateMask() {
    // Draws a rectangle mask that grows upwards as layers print
    graphicsMask.clear();
    graphicsMask.fillStyle(0xffffff);
    
    let currentHeight = printObject.height * (currentLayer / totalLayers);
    let startY = printObject.y - currentHeight;
    
    graphicsMask.fillRect(printObject.x - (printObject.width/2), startY, printObject.width, currentHeight);
}

// ==========================================
// UPGRADES & UI LOGIC
// ==========================================
function setupUpgradeButtons(scene) {
    const btnY = 1700;
    const padding = 250;
    const centerX = scene.scale.width / 2;

    // Speed Upgrade
    btnSpeed = scene.add.rectangle(centerX - padding, btnY, 400, 180, 0xe94560).setInteractive();
    scene.add.text(centerX - padding, btnY - 30, 'UPGRADE SPEED', { fontSize: '36px', fontStyle: 'bold' }).setOrigin(0.5);
    btnSpeedText = scene.add.text(centerX - padding, btnY + 30, 'Cost: ' + formatMoney(getSpeedCost()), { fontSize: '32px' }).setOrigin(0.5);

    btnSpeed.on('pointerdown', () => {
        let cost = getSpeedCost();
        if (saveData.cash >= cost) {
            saveData.cash -= cost;
            saveData.speedLevel++;
            cashText.setText(formatMoney(saveData.cash));
            btnSpeedText.setText('Cost: ' + formatMoney(getSpeedCost()));
        }
    });

    // Profit Upgrade
    btnProfit = scene.add.rectangle(centerX + padding, btnY, 400, 180, 0x4ecca3).setInteractive();
    scene.add.text(centerX + padding, btnY - 30, 'BETTER FILAMENT', { fontSize: '36px', fontStyle: 'bold', color: '#000' }).setOrigin(0.5);
    btnProfitText = scene.add.text(centerX + padding, btnY + 30, 'Cost: ' + formatMoney(getProfitCost()), { fontSize: '32px', color: '#000' }).setOrigin(0.5);

    btnProfit.on('pointerdown', () => {
        let cost = getProfitCost();
        if (saveData.cash >= cost) {
            saveData.cash -= cost;
            saveData.profitLevel++;
            cashText.setText(formatMoney(saveData.cash));
            btnProfitText.setText('Cost: ' + formatMoney(getProfitCost()));
        }
    });
}

// ==========================================
// UTILITIES
// ==========================================
function formatMoney(amount) {
    if (amount >= 1000000) return '$' + (amount / 1000000).toFixed(2) + 'M';
    if (amount >= 1000) return '$' + (amount / 1000).toFixed(2) + 'K';
    return '$' + amount.toFixed(2);
}

function spawnFloatingText(scene, x, y, text, color = '#4ecca3', size = 42) {
    let floatingText = scene.add.text(x, y, text, { fontSize: size + 'px', color: color, fontStyle: 'bold' }).setOrigin(0.5);
    scene.tweens.add({
        targets: floatingText,
        y: y - 150,
        alpha: 0,
        duration: 1200,
        ease: 'Power1',
        onComplete: () => floatingText.destroy()
    });
}
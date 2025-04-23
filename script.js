function formatNumber(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
    return n.toString();
}

function showTab(tabName) {
    document.getElementById("recipeTab").classList.add("hidden");
    document.getElementById("priceTab").classList.add("hidden");
    document.getElementById("bazaarTab").classList.add("hidden");
    document.querySelectorAll(".tab-button").forEach(btn => btn.classList.remove("active"));

    if (tabName === "recipe") {
        document.getElementById("recipeTab").classList.remove("hidden");
        document.querySelector(".tab-button:nth-child(1)").classList.add("active");
    } else if (tabName === "price") {
        document.getElementById("priceTab").classList.remove("hidden");
        document.querySelector(".tab-button:nth-child(2)").classList.add("active");
    } else if (tabName === "bazaar") {
        document.getElementById("bazaarTab").classList.remove("hidden");
        document.querySelector(".tab-button:nth-child(3)").classList.add("active");
        loadBazaarFlips();
    }
}

let searchHistory = [];
let currentItem = null;

function updateHistoryList(itemName) {
    if (!searchHistory.includes(itemName)) {
        searchHistory.unshift(itemName);
        if (searchHistory.length > 10) searchHistory.pop();
    }

    const list = document.getElementById("historyList");
    list.innerHTML = "";

    searchHistory.forEach(item => {
        const li = document.createElement("li");
        li.textContent = item.replace(/_/g, " ");
        li.onclick = () => searchFromHistory(item);
        list.appendChild(li);
    });
}

function searchFromHistory(itemName) {
    document.getElementById("itemInput").value = itemName.replace(/_/g, " ");
    fetchRecipe();
}

function refreshCurrentItem() {
    if (currentItem) {
        fetchRecipe();
    }
}

async function fetchRecipe() {
    const rawInput = document.getElementById("itemInput").value.trim();
    const itemName = rawInput.toUpperCase().replace(/\s+/g, "_");

    if (!itemName) {
        alert("Please enter an item name");
        return;
    }

    const apiUrl = `https://sky.coflnet.com/api/craft/recipe/${encodeURIComponent(itemName)}`;

    try {
        const response = await fetch(apiUrl);
        let itemCounts = {};

        if (response.ok) {
            const data = await response.json();

            Object.values(data).forEach(entry => {
                if (entry && entry.includes(":")) {
                    let [item, count] = entry.split(":");
                    count = parseInt(count, 10) || 1;
                    itemCounts[item] = (itemCounts[item] || 0) + count;
                }
            });

            const formattedOutput = Object.entries(itemCounts)
                .map(([item, count]) => `${item}: ${count}`)
                .join("\n");

            document.getElementById("output").textContent = formattedOutput;
        } else {
            document.getElementById("output").textContent = "No crafting recipe available. Fetching price only.";
        }

        currentItem = itemName;
        updateHistoryList(itemName);

        document.getElementById("itemNameHeader").textContent = itemName.replace(/_/g, " ");
        document.getElementById("searchContainer").classList.remove("centered");
        document.getElementById("resultArea").classList.remove("hidden");

        window.currentRecipe = Object.keys(itemCounts).length > 0 ? itemCounts : { [itemName]: 1 };
        await calculatePrice();

    } catch (error) {
        document.getElementById("output").textContent = "Error fetching recipe: " + error.message;
    }
}

async function fetchItemPrice(itemTag) {
    try {
        const response = await fetch(`https://sky.coflnet.com/api/item/price/${itemTag}`);
        if (!response.ok) throw new Error(`Price not found for ${itemTag}`);

        const data = await response.json();
        return data.min || data.median || 1;
    } catch (error) {
        return 1;
    }
}

async function getEffectivePrice(itemTag, visited = new Set()) {
    if (visited.has(itemTag)) return 1;
    visited.add(itemTag);

    const directPrice = await fetchItemPrice(itemTag);
    if (typeof directPrice === "number" && directPrice > 1) {
        return directPrice;
    }

    try {
        const response = await fetch(`https://sky.coflnet.com/api/craft/recipe/${itemTag}`);
        if (!response.ok) throw new Error("No crafting recipe found");

        const data = await response.json();
        let subRecipe = {};

        Object.values(data).forEach(entry => {
            if (entry && entry.includes(":")) {
                let [subItem, count] = entry.split(":");
                count = parseInt(count, 10) || 1;
                subRecipe[subItem] = (subRecipe[subItem] || 0) + count;
            }
        });

        let totalSubCost = 0;
        for (const [subItem, qty] of Object.entries(subRecipe)) {
            const subPrice = await getEffectivePrice(subItem, visited);
            totalSubCost += subPrice * qty;
        }

        return totalSubCost;

    } catch {
        return 1;
    }
}

async function fetchTopBazaarFlips() {
    try {
        const response = await fetch('https://api.coop.land/bazaar/flips');
        const data = await response.json();
        if (data.error) {
            throw new Error('Error fetching Bazaar flips');
        }
        return data.flips.slice(0, 5);
    } catch (error) {
        console.error('Error fetching Bazaar flips:', error);
        return [];
    }
}

async function loadBazaarFlips() {
    const container = document.getElementById("bazaarFlipContainer");
    container.innerHTML = "Loading top Bazaar flips...";

    const flips = await fetchTopBazaarFlips();

    container.innerHTML = "";
    flips.forEach(flip => {
        const flipDiv = document.createElement("div");
        flipDiv.className = "bazaar-flip";
        flipDiv.innerHTML = `
            <h3>${flip.itemName}</h3>
            <p><strong>Buy Price:</strong> ${formatNumber(flip.buyPrice)}</p>
            <p><strong>Sell Price:</strong> ${formatNumber(flip.sellPrice)}</p>
            <p><strong>Profit:</strong> ${formatNumber(flip.profit)}</p>
        `;
        container.appendChild(flipDiv);
    });
}

async function calculatePrice() {
    if (!window.currentRecipe) {
        alert("Get the recipe first!");
        return;
    }

    let totalCraftingCost = 0;
    let priceDetails = "Crafting Costs:\n";

    for (const [itemTag, quantity] of Object.entries(window.currentRecipe)) {
        const price = await getEffectivePrice(itemTag);
        const itemTotal = price * quantity;
        priceDetails += `- ${itemTag}: ${formatNumber(price)} x ${quantity} = ${formatNumber(itemTotal)}\n`;
        totalCraftingCost += itemTotal;
    }

    const rawInput = document.getElementById("itemInput").value.trim();
    const itemName = rawInput.toUpperCase().replace(/\s+/g, "_");
    const originalPrice = await fetchItemPrice(itemName);

    const priceOutputElement = document.getElementById("priceOutput");
    priceOutputElement.innerText =
        `${priceDetails}\nTotal Crafting Cost: ${formatNumber(totalCraftingCost)}\n\n` +
        `Lowest BIN (if any): ${formatNumber(originalPrice)}`;
    priceOutputElement.style.display = "block";
}

// Toggle dropdown for history
function toggleHistory() {
    const historyList = document.getElementById("historyList");
    historyList.classList.toggle("collapsed");

    const h3 = document.querySelector("#historyPanel h3");
    h3.innerHTML = historyList.classList.contains("collapsed") ? "History ⏷" : "History ⏶";
}

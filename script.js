async function fetchRecipe() {
    const itemName = document.getElementById("itemInput").value.trim();
    if (!itemName) {
        alert("Please enter an item name");
        return;
    }

    const apiUrl = `https://sky.coflnet.com/api/craft/recipe/${encodeURIComponent(itemName)}`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error("Failed to fetch recipe");
        }

        const data = await response.json();
        const outputElement = document.getElementById("output");

        // Check if recipe exists
        if (!data || !data.ingredients) {
            outputElement.textContent = "No recipe found.";
            return;
        }

        // Format the output
        let outputHTML = "<h3>Recipe for " + itemName + ":</h3><ul>";
        data.ingredients.forEach(item => {
            outputHTML += `<li>${item.name}: ${item.amount}</li>`;
        });
        outputHTML += "</ul>";

        outputElement.innerHTML = outputHTML;
    } catch (error) {
        document.getElementById("output").textContent = "Error fetching recipe: " + error.message;
    }
}
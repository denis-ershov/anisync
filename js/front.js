window.onload = function() {
    let table = document.querySelector("body > div > table > tbody");
    for (var i = 0, row; row = table.rows[i]; i++) {
        if (row.cells[7] >= "20") {
            document.querySelector('row.cells[7]').style.backgroundColor = "#dad1f4";
        }
    }
    console.log("Front Done!")
}

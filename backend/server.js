const http = require("http");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/notifications") {
        let body = "";

        req.on("data", chunk => {
            body += chunk;
        });

        req.on("end", () => {
            console.log("YooMoney notification:", body);

            res.writeHead(200, {
                "Content-Type": "text/plain"
            });

            res.end("OK");
        });

        return;
    }

    res.writeHead(200, {
        "Content-Type": "text/plain"
    });

    res.end("YOOMoney API работает 🚀");
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
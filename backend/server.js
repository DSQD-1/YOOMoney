const http = require("http");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    const url = new URL(
        req.url,
        `http://${req.headers.host || "localhost"}`
    );

    // Проверка сервера
    if (req.method === "GET" && url.pathname === "/") {
        res.writeHead(200, {
            "Content-Type": "text/plain; charset=utf-8"
        });

        res.end("YOOMoney API работает 🚀");
        return;
    }

    // OAuth callback
    if (req.method === "GET" && url.pathname === "/oauth/callback") {
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8"
        });

        if (error) {
            res.end(`
                <h1>Ошибка авторизации</h1>
                <p>${error}</p>
            `);
            return;
        }

        if (!code) {
            res.end(`
                <h1>YOOMoney</h1>
                <p>Код авторизации не получен.</p>
            `);
            return;
        }

        console.log("Получен OAuth code:", code);

        res.end(`
            <h1>YOOMoney</h1>
            <p>Авторизация получена ✅</p>
            <p>Можно вернуться в приложение.</p>
        `);

        return;
    }

    // YooMoney notifications
    if (
        req.method === "POST" &&
        url.pathname === "/notifications"
    ) {
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

    res.writeHead(404, {
        "Content-Type": "text/plain"
    });

    res.end("Not Found");
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
const http = require("http");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.YOOMONEY_CLIENT_ID;

const REDIRECT_URI =
    "https://yoomoney-api.onrender.com/oauth/callback";

function sendHTML(res, status, html) {
    res.writeHead(status, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
    });

    res.end(html);
}

function sendText(res, status, text) {
    res.writeHead(status, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store"
    });

    res.end(text);
}

async function exchangeCode(code) {
    if (!CLIENT_ID) {
        throw new Error(
            "YOOMONEY_CLIENT_ID отсутствует в Render Environment"
        );
    }

    const body = new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI
    });

    const response = await fetch(
        "https://yoomoney.ru/oauth/token",
        {
            method: "POST",
            headers: {
                "Content-Type":
                    "application/x-www-form-urlencoded"
            },
            body: body.toString()
        }
    );

    const text = await response.text();

    console.log(
        "ЮMoney token HTTP status:",
        response.status
    );

    let data;

    try {
        data = JSON.parse(text);
    } catch {
        throw new Error(
            "ЮMoney вернул неожиданный ответ"
        );
    }

    if (!response.ok || data.error) {
        throw new Error(
            data.error_description ||
            data.error ||
            "Ошибка обмена code на token"
        );
    }

    if (!data.access_token) {
        throw new Error(
            "В ответе ЮMoney отсутствует access_token"
        );
    }

    return data;
}

const server = http.createServer(async (req, res) => {
    const url = new URL(
        req.url,
        `http://${req.headers.host || "localhost"}`
    );

    // ==========================================
    // Главная
    // ==========================================

    if (
        req.method === "GET" &&
        url.pathname === "/"
    ) {
        sendText(
            res,
            200,
            "YOOMoney API работает 🚀"
        );

        return;
    }

    // ==========================================
    // OAuth callback
    // ==========================================

    if (
        req.method === "GET" &&
        url.pathname === "/oauth/callback"
    ) {
        const code =
            url.searchParams.get("code");

        const error =
            url.searchParams.get("error");

        const errorDescription =
            url.searchParams.get(
                "error_description"
            );

        console.log(
            "OAuth callback получен"
        );

        console.log(
            "OAuth error:",
            error || "нет"
        );

        console.log(
            "OAuth error description:",
            errorDescription || "нет"
        );

        // ЮMoney сообщил об ошибке
        if (error) {
            sendHTML(
                res,
                400,
                `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta
        name="viewport"
        content="width=device-width,
        initial-scale=1.0"
    >
    <title>YOOMoney</title>
</head>

<body style="
    margin:0;
    background:#000;
    color:#fff;
    font-family:-apple-system,
    BlinkMacSystemFont,sans-serif;
    text-align:center;
    padding:60px 20px;
">

    <h1>Ошибка ЮMoney</h1>

    <p style="
        color:#aaa;
        font-size:17px;
    ">
        ${error}
    </p>

    <p style="
        color:#777;
        font-size:14px;
    ">
        ${errorDescription || ""}
    </p>

</body>
</html>
                `
            );

            return;
        }

        // Нет code
        if (!code) {
            console.log(
                "OAuth code отсутствует"
            );

            sendHTML(
                res,
                400,
                `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta
        name="viewport"
        content="width=device-width,
        initial-scale=1.0"
    >
    <title>YOOMoney</title>
</head>

<body style="
    margin:0;
    background:#000;
    color:#fff;
    font-family:-apple-system,
    BlinkMacSystemFont,sans-serif;
    text-align:center;
    padding:60px 20px;
">

    <h1>Код не получен</h1>

    <p style="color:#aaa;">
        ЮMoney не передал код авторизации.
    </p>

</body>
</html>
                `
            );

            return;
        }

        try {
            console.log(
                "OAuth code получен"
            );

            const tokenData =
                await exchangeCode(code);

            console.log(
                "access_token успешно получен ✅"
            );

            /*
             * ВАЖНО:
             *
             * Сам access_token здесь
             * намеренно НЕ выводим.
             *
             * Следующим этапом сделаем
             * серверную сессию пользователя.
             */

            sendHTML(
                res,
                200,
                `
<!DOCTYPE html>
<html lang="ru">

<head>
    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width,
        initial-scale=1.0"
    >

    <title>YOOMoney</title>
</head>

<body style="
    margin:0;
    background:#000;
    color:#fff;
    font-family:-apple-system,
    BlinkMacSystemFont,sans-serif;
    text-align:center;
    padding:60px 20px;
">

    <div style="
        width:86px;
        height:86px;
        border-radius:25px;
        background:#ff9500;
        margin:0 auto 25px;

        display:flex;
        align-items:center;
        justify-content:center;

        font-size:42px;
        font-weight:bold;
    ">
        ₽
    </div>

    <h1>
        Авторизация успешна ✅
    </h1>

    <p style="
        color:#aaa;
        font-size:17px;
    ">
        Аккаунт ЮMoney успешно подключён.
    </p>

    <p style="
        color:#666;
        font-size:14px;
    ">
        Можно вернуться в приложение YOOMoney.
    </p>

</body>

</html>
                `
            );

        } catch (err) {
            console.error(
                "OAuth token error:",
                err.message
            );

            sendHTML(
                res,
                500,
                `
<!DOCTYPE html>
<html lang="ru">

<head>
    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width,
        initial-scale=1.0"
    >

    <title>YOOMoney</title>
</head>

<body style="
    margin:0;
    background:#000;
    color:#fff;
    font-family:-apple-system,
    BlinkMacSystemFont,sans-serif;
    text-align:center;
    padding:60px 20px;
">

    <h1>
        Не удалось получить токен
    </h1>

    <p style="
        color:#aaa;
        font-size:17px;
    ">
        ${err.message}
    </p>

    <p style="
        color:#666;
        font-size:14px;
    ">
        Попробуйте авторизоваться ещё раз.
    </p>

</body>

</html>
                `
            );
        }

        return;
    }

    // ==========================================
    // Уведомления ЮMoney
    // ==========================================

    if (
        req.method === "POST" &&
        url.pathname === "/notifications"
    ) {
        let body = "";

        req.on("data", chunk => {
            body += chunk;
        });

        req.on("end", () => {
            console.log(
                "Получено уведомление ЮMoney"
            );

            sendText(
                res,
                200,
                "OK"
            );
        });

        return;
    }

    // ==========================================
    // 404
    // ==========================================

    sendText(
        res,
        404,
        "Not Found"
    );
});

server.listen(PORT, () => {
    console.log(
        `YOOMoney API запущен на порту ${PORT}`
    );
});
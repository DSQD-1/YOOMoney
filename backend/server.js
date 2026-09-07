const http = require("http");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;

// Client ID хранится в Render → Environment
const CLIENT_ID = process.env.YOOMONEY_CLIENT_ID;

const REDIRECT_URI =
    "https://yoomoney-api.onrender.com/oauth/callback";

function send(res, status, contentType, body) {
    res.writeHead(status, {
        "Content-Type": contentType,
        "Cache-Control": "no-store"
    });

    res.end(body);
}

// Обмен OAuth code на access_token
async function getAccessToken(code) {
    if (!CLIENT_ID) {
        throw new Error(
            "YOOMONEY_CLIENT_ID не настроен в Render"
        );
    }

    const params = new URLSearchParams();

    params.append("code", code);
    params.append("client_id", CLIENT_ID);
    params.append("grant_type", "authorization_code");
    params.append("redirect_uri", REDIRECT_URI);

    const response = await fetch(
        "https://yoomoney.ru/oauth/token",
        {
            method: "POST",

            headers: {
                "Content-Type":
                    "application/x-www-form-urlencoded"
            },

            body: params.toString()
        }
    );

    const text = await response.text();

    let data;

    try {
        data = JSON.parse(text);
    } catch {
        throw new Error(
            "ЮMoney вернул некорректный ответ"
        );
    }

    if (!response.ok || data.error) {
        throw new Error(
            data.error_description ||
            data.error ||
            "Не удалось получить токен"
        );
    }

    if (!data.access_token) {
        throw new Error(
            "ЮMoney не вернул access_token"
        );
    }

    return data.access_token;
}

const server = http.createServer(async (req, res) => {
    const url = new URL(
        req.url,
        `http://${req.headers.host || "localhost"}`
    );

    // ==============================
    // Проверка сервера
    // ==============================

    if (
        req.method === "GET" &&
        url.pathname === "/"
    ) {
        send(
            res,
            200,
            "text/plain; charset=utf-8",
            "YOOMoney API работает 🚀"
        );

        return;
    }

    // ==============================
    // ЮMoney OAuth callback
    // ==============================

    if (
        req.method === "GET" &&
        url.pathname === "/oauth/callback"
    ) {
        const code =
            url.searchParams.get("code");

        const error =
            url.searchParams.get("error");

        // Пользователь отменил авторизацию
        if (error) {
            send(
                res,
                400,
                "text/html; charset=utf-8",
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
                    font-family:
                    -apple-system,
                    BlinkMacSystemFont,
                    sans-serif;
                    text-align:center;
                    padding:60px 20px;
                ">

                    <h1>
                        Авторизация отменена
                    </h1>

                    <p style="
                        color:#999;
                        font-size:17px;
                    ">
                        Вы отменили вход через ЮMoney.
                    </p>

                </body>

                </html>
                `
            );

            return;
        }

        // ЮMoney не прислал code
        if (!code) {
            send(
                res,
                400,
                "text/html; charset=utf-8",
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
                    font-family:
                    -apple-system,
                    BlinkMacSystemFont,
                    sans-serif;
                    text-align:center;
                    padding:60px 20px;
                ">

                    <h1>
                        Ошибка авторизации
                    </h1>

                    <p style="
                        color:#999;
                    ">
                        Код авторизации не получен.
                    </p>

                </body>

                </html>
                `
            );

            return;
        }

        try {
            console.log(
                "Получен OAuth authorization code"
            );

            // Получаем access_token
            const accessToken =
                await getAccessToken(code);

            // Никогда не выводим access_token
            // в Render logs.

            console.log(
                "ЮMoney: access token получен ✅"
            );

            /*
             * Сейчас токен существует только
             * внутри этого запроса.
             *
             * Следующим этапом мы сделаем:
             *
             * access_token
             *       ↓
             * серверная сессия
             *       ↓
             * iPhone
             *       ↓
             * баланс
             * история
             */

            send(
                res,
                200,
                "text/html; charset=utf-8",
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
                    font-family:
                    -apple-system,
                    BlinkMacSystemFont,
                    sans-serif;
                    text-align:center;
                    padding:60px 20px;
                ">

                    <div style="
                        width:80px;
                        height:80px;
                        background:#ff9500;
                        border-radius:24px;
                        margin:0 auto 25px;

                        display:flex;
                        align-items:center;
                        justify-content:center;

                        font-size:40px;
                    ">
                        ₽
                    </div>

                    <h1>
                        Авторизация успешна ✅
                    </h1>

                    <p style="
                        color:#999;
                        font-size:17px;
                        line-height:1.5;
                    ">
                        Ваш аккаунт ЮMoney успешно
                        подключён к YOOMoney.
                    </p>

                    <p style="
                        color:#666;
                        font-size:14px;
                    ">
                        Можно вернуться в приложение.
                    </p>

                </body>

                </html>
                `
            );

        } catch (error) {
            console.error(
                "OAuth error:",
                error.message
            );

            send(
                res,
                500,
                "text/html; charset=utf-8",
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
                    font-family:
                    -apple-system,
                    BlinkMacSystemFont,
                    sans-serif;
                    text-align:center;
                    padding:60px 20px;
                ">

                    <h1>
                        Не удалось войти
                    </h1>

                    <p style="
                        color:#999;
                        font-size:17px;
                    ">
                        ЮMoney не подтвердил авторизацию.
                    </p>

                    <p style="
                        color:#666;
                        font-size:14px;
                    ">
                        Попробуйте войти ещё раз.
                    </p>

                </body>

                </html>
                `
            );
        }

        return;
    }

    // ==============================
    // Уведомления ЮMoney
    // ==============================

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

            send(
                res,
                200,
                "text/plain; charset=utf-8",
                "OK"
            );
        });

        return;
    }

    // ==============================
    // 404
    // ==============================

    send(
        res,
        404,
        "text/plain; charset=utf-8",
        "Not Found"
    );
});

server.listen(PORT, () => {
    console.log(
        `YOOMoney API запущен на порту ${PORT}`
    );
});
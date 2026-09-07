const http = require("http");
const { URL } = require("url");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.YOOMONEY_CLIENT_ID;

const REDIRECT_URI =
    "https://yoomoney-api.onrender.com/oauth/callback";

// Временное хранилище сессий.
// Позже заменим на нормальную БД.
const sessions = new Map();


// ==========================================
// Вспомогательные функции
// ==========================================

function sendJSON(res, status, data) {
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
    });

    res.end(JSON.stringify(data));
}


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


// ==========================================
// Создание session ID
// ==========================================

function createSession(accessToken) {
    const sessionId =
        crypto.randomBytes(32).toString("hex");

    sessions.set(sessionId, {
        accessToken: accessToken,
        createdAt: Date.now()
    });

    return sessionId;
}


// ==========================================
// Получение сессии
// ==========================================

function getSession(sessionId) {
    if (!sessionId) {
        return null;
    }

    const session = sessions.get(sessionId);

    if (!session) {
        return null;
    }

    // Сессия действует 1 час
    const ONE_HOUR = 60 * 60 * 1000;

    if (
        Date.now() - session.createdAt >
        ONE_HOUR
    ) {
        sessions.delete(sessionId);
        return null;
    }

    return session;
}


// ==========================================
// OAuth code → access_token
// ==========================================

async function exchangeCode(code) {
    if (!CLIENT_ID) {
        throw new Error(
            "YOOMONEY_CLIENT_ID отсутствует в Render Environment"
        );
    }

    const body = new URLSearchParams({
        code: code,
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
            "Ошибка получения access_token"
        );
    }

    if (!data.access_token) {
        throw new Error(
            "ЮMoney не вернул access_token"
        );
    }

    return data.access_token;
}


// ==========================================
// Получение баланса ЮMoney
// ==========================================

async function getBalance(accessToken) {
    const response = await fetch(
        "https://yoomoney.ru/api/account-info",
        {
            method: "POST",

            headers: {
                "Authorization":
                    `Bearer ${accessToken}`,

                "Content-Type":
                    "application/x-www-form-urlencoded"
            },

            body: ""
        }
    );

    const text = await response.text();

    let data;

    try {
        data = JSON.parse(text);
    } catch {
        throw new Error(
            "ЮMoney вернул некорректный ответ баланса"
        );
    }

    if (!response.ok) {
        throw new Error(
            data.error ||
            "Не удалось получить баланс"
        );
    }

    return data;
}


// ==========================================
// HTTP SERVER
// ==========================================

const server = http.createServer(
    async (req, res) => {

        const url = new URL(
            req.url,
            `http://${req.headers.host || "localhost"}`
        );


        // ======================================
        // Главная
        // ======================================

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


        // ======================================
        // OAuth CALLBACK
        // ======================================

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


            // Пользователь отказался
            if (error) {

                console.log(
                    "OAuth error:",
                    error
                );

                console.log(
                    "OAuth error description:",
                    errorDescription || "нет"
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

<h1>Авторизация отменена</h1>

<p style="
color:#aaa;
font-size:17px;
">
${errorDescription || error}
</p>

</body>
</html>
                    `
                );

                return;
            }


            // Нет code
            if (!code) {

                sendHTML(
                    res,
                    400,
                    `
<!DOCTYPE html>
<html lang="ru">

<head>
<meta charset="UTF-8">
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

<h1>Код авторизации не получен</h1>

<p style="color:#aaa;">
Попробуйте авторизоваться ещё раз.
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


                // Получаем access_token
                const accessToken =
                    await exchangeCode(code);


                console.log(
                    "access_token успешно получен ✅"
                );


                // Создаём серверную сессию
                const sessionId =
                    createSession(accessToken);


                console.log(
                    "Сессия пользователя создана ✅"
                );


                /*
                 * ВАЖНО:
                 *
                 * access_token НЕ отправляем
                 * пользователю.
                 *
                 * В приложение передаём
                 * только session_id.
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

ЮMoney успешно подключён.

</p>

<p style="
color:#666;
font-size:14px;
">

Сессия создана.

</p>

</body>

</html>
                    `
                );


                /*
                 * Пока sessionId не передаём
                 * в браузер.
                 *
                 * Следующим шагом сделаем
                 * безопасный возврат
                 * в iPhone-приложение.
                 */


            } catch (err) {

                console.error(
                    "OAuth error:",
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
Ошибка авторизации
</h1>

<p style="
color:#aaa;
font-size:17px;
">

${err.message}

</p>

</body>

</html>
                    `
                );
            }

            return;
        }


        // ======================================
        // BALANCE
        // ======================================

        if (
            req.method === "GET" &&
            url.pathname === "/api/balance"
        ) {

            const sessionId =
                url.searchParams.get(
                    "session_id"
                );


            const session =
                getSession(sessionId);


            if (!session) {

                sendJSON(
                    res,
                    401,
                    {
                        success: false,
                        error:
                            "Сессия недействительна"
                    }
                );

                return;
            }


            try {

                const account =
                    await getBalance(
                        session.accessToken
                    );


                sendJSON(
                    res,
                    200,
                    {
                        success: true,

                        balance:
                            account.balance,

                        currency:
                            account.currency,

                        account:
                            account.account,

                        account_status:
                            account.account_status,

                        account_type:
                            account.account_type
                    }
                );


            } catch (err) {

                console.error(
                    "Balance error:",
                    err.message
                );


                sendJSON(
                    res,
                    500,
                    {
                        success: false,
                        error:
                            "Не удалось получить баланс"
                    }
                );
            }

            return;
        }


        // ======================================
        // УДАЛЕНИЕ СЕССИИ / LOGOUT
        // ======================================

        if (
            req.method === "POST" &&
            url.pathname === "/api/logout"
        ) {

            const sessionId =
                url.searchParams.get(
                    "session_id"
                );


            if (sessionId) {
                sessions.delete(sessionId);
            }


            sendJSON(
                res,
                200,
                {
                    success: true
                }
            );

            return;
        }


        // ======================================
        // Уведомления ЮMoney
        // ======================================

        if (
            req.method === "POST" &&
            url.pathname === "/notifications"
        ) {

            let body = "";

            req.on(
                "data",
                chunk => {
                    body += chunk;
                }
            );


            req.on(
                "end",
                () => {

                    console.log(
                        "Получено уведомление ЮMoney"
                    );

                    sendText(
                        res,
                        200,
                        "OK"
                    );
                }
            );

            return;
        }


        // ======================================
        // 404
        // ======================================

        sendJSON(
            res,
            404,
            {
                success: false,
                error: "Not Found"
            }
        );
    }
);


// ==========================================
// START
// ==========================================

server.listen(
    PORT,
    () => {

        console.log(
            `YOOMoney API запущен на порту ${PORT}`
        );

        if (!CLIENT_ID) {

            console.warn(
                "ВНИМАНИЕ: YOOMONEY_CLIENT_ID не задан!"
            );

        } else {

            console.log(
                "YOOMONEY_CLIENT_ID найден ✅"
            );
        }
    }
);
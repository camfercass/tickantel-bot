import { chromium } from "playwright";
import dotenv from "dotenv";

dotenv.config();

const URL_TICKANTEL = "https://tickantel.com.uy/inicio/espectaculo/40019797/espectaculo/Clausura%202025%20-%20Pe%C3%B1arol%20vs%20Defensor%20Sporting?2";

const INTERVAL_MIN = parseInt(process.env.CHECK_INTERVAL || "5", 10);

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN!;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID!;
const WHATSAPP_TO = process.env.WHATSAPP_TO!;

let alreadyNotified = false;

async function sendWhatsApp(text: string): Promise<void> {
    const urlWhatsapp = `https://graph.facebook.com/v24.0/${WHATSAPP_PHONE_ID}/messages`;

    const res = await fetch(urlWhatsapp, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${WHATSAPP_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: WHATSAPP_TO,
            type: "text",
            text: { preview_url: false, body: text },
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        console.error("❌ Error al enviar WhatsApp:", err);
    } else {
        console.log("📲 WhatsApp enviado correctamente!");
    }
}

async function sendTelegram(text: string): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN!;
    const chatId = process.env.TELEGRAM_CHAT_ID!;

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: "HTML"
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Telegram API error (${res.status}): ${err}`);
    }
}


async function checkAvailability(): Promise<void> {
    console.log("🔍 Revisando TickAntel...");

    const browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"], // necesario en Railway
    });

    const page = await browser.newPage();

    try {
        await page.goto(URL_TICKANTEL, { waitUntil: "networkidle" });

        const html = await page.content();

        let cataldiAvailable = false;
        let damianiAvailable = false;

        page.on('console', (msg) => {
            console.log('📜 [Browser]', msg.text());
        });

        // Chequeo Tribuna Cataldi
        const disponibleCataldi: boolean = await page.evaluate(() => {
            // Buscar todos los divs que podrían ser contenedores
            const divs = document.querySelectorAll('div.lista-visibilidad');
            // divs.forEach((div) => {console.log({div})})
            for (const div of divs) {
                // Buscar el span dentro con el nombre que queremos
                const nombre = div.querySelector('.auto-nombre-VisibilidadSector')?.textContent?.trim();
                // console.log({nombre})
                if (nombre === 'Tr. W. Cataldi') {
                    // Si tiene la clase disabled, no hay entradas
                    // console.log({div: div.classList.toString()})
                    return !div.classList.contains('disabled');
                }
            }
            // Si no lo encontró, devolvemos false
            console.log("No existe cataldi")
            return false;
        });

        if (disponibleCataldi) {
            cataldiAvailable = true
            console.log("🎫 Hay entradas disponibles en Tr. W. Cataldi");
        } else {
            console.log("❌ No hay entradas para Tr. W. Cataldi");
        }

        // Chequeo Tribuna Damiani Puerta C
        const disponibleDamianiC = await page.evaluate(() => {
            // Buscar todos los divs que podrían ser contenedores
            const divs = document.querySelectorAll('div.lista-visibilidad');

            for (const div of divs) {
                // Buscar el span dentro con el nombre que queremos
                const nombre = div.querySelector('.auto-nombre-VisibilidadSector')?.textContent?.trim();
                if (nombre === 'Tr. Damiani - Puerta C') {
                    // Si tiene la clase disabled, no hay entradas
                    return !div.classList.contains('disabled');
                }
            }
            // Si no lo encontró, devolvemos false
            console.log("No existe damiani C")
            return false;
        });

        if (disponibleDamianiC) {
            damianiAvailable = true
            console.log("🎫 Hay entradas disponibles en Tr. Damiani - Puerta C");
        } else {
            console.log("❌ No hay entradas para Tr. Damiani - Puerta C");
        }

        // Chequeo Tribuna Damiani Puerta D
        const disponibleDamianiD = await page.evaluate(() => {
            // Buscar todos los divs que podrían ser contenedores
            const divs = document.querySelectorAll('div.lista-visibilidad');

            for (const div of divs) {
                // Buscar el span dentro con el nombre que queremos
                const nombre = div.querySelector('.auto-nombre-VisibilidadSector')?.textContent?.trim();
                if (nombre === 'Tr. Damiani - Puerta D') {
                    // Si tiene la clase disabled, no hay entradas
                    return !div.classList.contains('disabled');
                }
            }
            // Si no lo encontró, devolvemos false
            console.log("No existe damiani D")
            return false;
        });

        if (disponibleDamianiD) {
            damianiAvailable = true
            console.log("🎫 Hay entradas disponibles en Tr. Damiani - Puerta D");
        } else {
            console.log("❌ No hay entradas para Tr. Damiani - Puerta D");
        }

        if ((cataldiAvailable || damianiAvailable) && !alreadyNotified) {
            const tribunas: string[] = [];
            if (cataldiAvailable) tribunas.push("Cataldi");
            if (damianiAvailable) tribunas.push("Damiani");

            const msg = `🎫 Entradas disponibles en: ${tribunas.join(", ")}\n👉 ${URL_TICKANTEL}`;
            await sendTelegram(msg);
            //   await sendWhatsApp(msg);
            alreadyNotified = true;
        } else if (!cataldiAvailable && !damianiAvailable) {
            alreadyNotified = false;
            console.log("❌ No hay entradas en Cataldi ni Damiani.");
        }
    } catch (err) {
        console.error("⚠️ Error:", err);
    } finally {
        await browser.close();
    }
}

checkAvailability();
setInterval(checkAvailability, INTERVAL_MIN * 60 * 1000);

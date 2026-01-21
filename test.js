
    require('dotenv').config()
    const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
    const Pino = require('pino')
    const fs = require('fs')
    const path = require('path')
    const axios = require('axios')

    const games = {} // XO games

    async function start() {
      const { state, saveCreds } = await useMultiFileAuthState('./sessions')
      const sock = makeWASocket({
        logger: Pino({ level: 'silent' }),
        auth: state
      })

      sock.ev.on('creds.update', saveCreds)

      sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0]
        if (!msg.message || msg.key.fromMe) return

        const from = msg.key.remoteJid
        const text =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          ''

        // Commands
        if (text === '1' || text === 'xo') {
          games[from] = Array(9).fill(null)
          return sock.sendMessage(from, { text: '🎮 لعبة XO بدأت\nاختار رقم من 1 لـ 9' })
        }

        if (games[from]) {
          const idx = parseInt(text) - 1
          if (idx >= 0 && idx < 9 && !games[from][idx]) {
            games[from][idx] = 'X'
            const board = games[from]
              .map((v, i) => v ? v : (i+1))
              .reduce((a, c, i) => a + c + ((i%3===2)?'\n':' | '), '')
            return sock.sendMessage(from, { text: board })
          }
        }

        if (text.startsWith('ai ')) {
          if (!process.env.OPENAI_API_KEY) {
            return sock.sendMessage(from, { text: '❌ حط OPENAI_API_KEY في Environment' })
          }
          try {
            const q = text.replace('ai ', '')
            const r = await axios.post('https://api.openai.com/v1/chat/completions', {
              model: 'gpt-4o-mini',
              messages: [{ role: 'user', content: q }]
            }, {
              headers: {
                'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY,
                'Content-Type': 'application/json'
              }
            })
            return sock.sendMessage(from, { text: r.data.choices[0].message.content })
          } catch (e) {
            return sock.sendMessage(from, { text: 'حصل خطأ في AI' })
          }
        }

        if (text === 'الاوامر') {
          return sock.sendMessage(from, {
            text: `📜 الأوامر:
1 أو xo → لعبة XO
ai سؤالك → ذكاء اصطناعي
الاوامر → عرض الأوامر`
          })
        }
      })
    }

    start()

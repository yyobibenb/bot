import express from "express";
import { TelegramBotService } from "../bot/telegramBot";
import { UserModel } from "../models/User";
import { BalanceModel } from "../models/Balance";
import { TransactionModel } from "../models/Transaction";
import { AdminModel } from "../models/Admin";
import { GameModel } from "../models/Game";
import { DiceGameService } from "../services/DiceGameService";
import { DiceDuelService } from "../services/DiceDuelService";
import { OtherGamesService } from "../services/OtherGamesService";
import { OtherGamesDuelService } from "../services/OtherGamesDuelService";
import cryptoService from "../services/CryptoService";
import cryptoBotService from "../services/CryptoBotService";
import { DuelService } from "../services/DuelService";
import { SlotsGameService } from "../services/SlotsGameService";
import { RPSGameService } from "../services/RPSGameService";
import { BroadcastModel } from "../models/Broadcast";
import { BroadcastService } from "../services/BroadcastService";
import pool from "../database/pool";

const app = express();

let telegramBot: TelegramBotService | null = null;

export function setTelegramBot(bot: TelegramBotService) {
  telegramBot = bot;
  console.log("✅ Telegram бот интегрирован с сервером");
}

let keepAliveInterval: NodeJS.Timeout | null = null;

function startKeepAlive(port: number) {
  const PING_INTERVAL = 4 * 60 * 1000;
  const url = process.env.PING_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;

  console.log(`🔄 Keep-alive запущен, пинг каждые 4 минуты: ${url}/health`);

  keepAliveInterval = setInterval(async () => {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) {
        console.log(`✅ Keep-alive ping успешен: ${new Date().toISOString()}`);
      }
    } catch (error) {
      console.log(`⚠️ Keep-alive ping ошибка: ${error}`);
    }
  }, PING_INTERVAL);
}

app.use(express.json());
app.use(express.static("public"));

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});


// Serve main page
app.get("/", (req, res) => {
  res.sendFile("index.html", { root: "./public" });
});

// API для сохранения данных пользователя
app.post("/api/user", async (req, res) => {
  try {
    const { telegram_id, username, first_name, last_name, language_code, photo_url, is_premium } = req.body;

    console.log('Received user data:', { telegram_id, username, first_name, last_name, photo_url });

    // Создаем или обновляем пользователя
    const user = await UserModel.createOrUpdate({
      telegram_id,
      username,
      first_name,
      last_name,
      language_code,
      photo_url,
      is_premium
    });

    // Создаем баланс, если его нет
    let balance = await BalanceModel.getByUserId(user.id);
    if (!balance) {
      balance = await BalanceModel.createForUser(user.id);
    }

    res.json({
      success: true,
      balance: parseFloat(balance.balance.toString()),
      user: {
        id: user.id,
        telegram_id: user.telegram_id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        language_code: user.language_code,
        photo_url: user.photo_url,
        is_premium: user.is_premium
      }
    });
  } catch (error) {
    console.error("Error saving user:", error);
    res.status(500).json({ success: false, error: "Failed to save user" });
  }
});

// API для получения пользователя по telegram_id
app.get("/api/user/telegram/:telegram_id", async (req, res) => {
  try {
    const telegram_id = parseInt(req.params.telegram_id);
    console.log(`📡 API: Запрос пользователя telegram_id=${telegram_id}`);

    const user = await UserModel.findByTelegramId(telegram_id);

    if (!user) {
      console.log(`❌ Пользователь ${telegram_id} не найден в БД`);
      return res.status(404).json({ success: false, error: "User not found" });
    }

    console.log(`✅ Пользователь найден:`, {
      id: user.id,
      telegram_id: user.telegram_id,
      first_name: user.first_name,
      photo_url: user.photo_url || 'NULL'
    });

    const balance = await BalanceModel.getByUserId(user.id);

    res.json({
      success: true,
      user: {
        id: user.id,
        telegram_id: user.telegram_id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        language_code: user.language_code,
        photo_url: user.photo_url,
        is_premium: user.is_premium
      },
      balance: balance ? parseFloat(balance.balance.toString()) : 0
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ success: false, error: "Failed to fetch user" });
  }
});

// API для получения списка игр
app.get("/api/games", async (req, res) => {
  try {
    const games = await GameModel.getAllGames();
    res.json({ success: true, games });
  } catch (error) {
    console.error("Error fetching games:", error);
    res.status(500).json({ success: false, error: "Failed to fetch games" });
  }
});

// API для получения режимов игры
app.get("/api/games/:gameId/modes", async (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    const modes = await GameModel.getGameModes(gameId);
    res.json({ success: true, modes });
  } catch (error) {
    console.error("Error fetching game modes:", error);
    res.status(500).json({ success: false, error: "Failed to fetch game modes" });
  }
});

// API для игры в кубик - Больше/Меньше
app.post("/api/games/dice/higher-lower", async (req, res) => {
  try {
    const { user_id, bet_amount, choice } = req.body;

    if (!user_id || !bet_amount || !choice) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    if (choice !== "higher" && choice !== "lower") {
      return res.status(400).json({ success: false, error: "Invalid choice" });
    }

    const result = await DiceGameService.playHigherLower(user_id, bet_amount, choice);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing dice:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

// API для игры в кубик - Четное/Нечетное
app.post("/api/games/dice/even-odd", async (req, res) => {
  try {
    const { user_id, bet_amount, choice } = req.body;

    if (!user_id || !bet_amount || !choice) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    if (choice !== "even" && choice !== "odd") {
      return res.status(400).json({ success: false, error: "Invalid choice" });
    }

    const result = await DiceGameService.playEvenOdd(user_id, bet_amount, choice);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing dice:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

// API для игры в кубик - Грань (точное число)
app.post("/api/games/dice/exact-number", async (req, res) => {
  try {
    const { user_id, bet_amount, choice } = req.body;

    if (!user_id || !bet_amount || choice === undefined) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const result = await DiceGameService.playExactNumber(user_id, bet_amount, parseInt(choice));
    res.json(result);
  } catch (error: any) {
    console.error("Error playing dice:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

// API для игры в кубик - Сектор
app.post("/api/games/dice/sector", async (req, res) => {
  try {
    const { user_id, bet_amount, sector } = req.body;

    if (!user_id || !bet_amount || !sector) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const sectorNum = parseInt(sector);
    if (sectorNum !== 1 && sectorNum !== 2 && sectorNum !== 3) {
      return res.status(400).json({ success: false, error: "Invalid sector. Must be 1, 2, or 3" });
    }

    const result = await DiceGameService.playSector(user_id, bet_amount, sectorNum as 1 | 2 | 3);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing dice:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

// API для игры в кубик - Дуэль
app.post("/api/games/dice/duel", async (req, res) => {
  try {
    const { user_id, bet_amount } = req.body;

    if (!user_id || !bet_amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const result = await DiceGameService.playDuel(user_id, bet_amount);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing dice:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

// API для игры в кубик - 2X2
app.post("/api/games/dice/double", async (req, res) => {
  try {
    const { user_id, bet_amount, choice } = req.body;

    if (!user_id || !bet_amount || !choice) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const result = await DiceGameService.playDouble(user_id, bet_amount, choice);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing dice:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

// API для игры в кубик - 3X3
app.post("/api/games/dice/triple", async (req, res) => {
  try {
    const { user_id, bet_amount, choice } = req.body;

    if (!user_id || !bet_amount || !choice) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const result = await DiceGameService.playTriple(user_id, bet_amount, choice);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing dice:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

// API для игры в кубик - Подряд (3 числа)
app.post("/api/games/dice/sequence", async (req, res) => {
  try {
    const { user_id, bet_amount, choices } = req.body;

    if (!user_id || !bet_amount || !choices || choices.length !== 3) {
      return res.status(400).json({ success: false, error: "Missing required fields or invalid choices" });
    }

    const result = await DiceGameService.playSequence(user_id, bet_amount, choices);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing dice:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

// ========================================
// DICE DUELS (PVP) - Дуэли между игроками
// ========================================

// Создать дуэль
app.post("/api/games/dice/duel/create", async (req, res) => {
  try {
    const { user_id, bet_amount } = req.body;

    if (!user_id || !bet_amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    if (bet_amount < 1) {
      return res.status(400).json({ success: false, error: "Bet amount must be at least 1 USDT" });
    }

    const result = await DiceDuelService.createDuel(user_id, bet_amount);
    res.json(result);
  } catch (error: any) {
    console.error("Error creating duel:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to create duel" });
  }
});

// Присоединиться к дуэли
app.post("/api/games/dice/duel/join", async (req, res) => {
  try {
    const { duel_id, user_id } = req.body;

    if (!duel_id || !user_id) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const result = await DiceDuelService.joinDuel(duel_id, user_id);
    res.json(result);
  } catch (error: any) {
    console.error("Error joining duel:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to join duel" });
  }
});

// Получить список открытых дуэлей
app.get("/api/games/dice/duel/list", async (req, res) => {
  try {
    const duels = await DiceDuelService.getAvailableDuels();
    res.json({ success: true, duels });
  } catch (error: any) {
    console.error("Error fetching duels:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch duels" });
  }
});

// Отменить дуэль
app.post("/api/games/dice/duel/cancel", async (req, res) => {
  try {
    const { duel_id, user_id } = req.body;

    if (!duel_id || !user_id) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const result = await DiceDuelService.cancelDuel(duel_id, user_id);
    res.json(result);
  } catch (error: any) {
    console.error("Error cancelling duel:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to cancel duel" });
  }
});

// API для получения истории игр пользователя
app.get("/api/user/:userId/history", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const history = await GameModel.getUserGameHistory(userId);
    res.json({ success: true, history });
  } catch (error) {
    console.error("Error fetching game history:", error);
    res.status(500).json({ success: false, error: "Failed to fetch game history" });
  }
});

// API для получения баланса пользователя
app.get("/api/user/:userId/balance", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const balance = await BalanceModel.getByUserId(userId);

    if (!balance) {
      return res.status(404).json({ success: false, error: "Balance not found" });
    }

    res.json({
      success: true,
      balance: parseFloat(balance.balance.toString()),
      total_deposited: parseFloat(balance.total_deposited.toString()),
      total_withdrawn: parseFloat(balance.total_withdrawn.toString())
    });
  } catch (error) {
    console.error("Error fetching balance:", error);
    res.status(500).json({ success: false, error: "Failed to fetch balance" });
  }
});

// ========== БОУЛИНГ API ==========

app.post("/api/games/bowling/strike", async (req, res) => {
  try {
    const { user_id, bet_amount } = req.body;
    if (!user_id || !bet_amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    const result = await OtherGamesService.playBowlingStrike(user_id, bet_amount);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing bowling:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

app.post("/api/games/bowling/duel", async (req, res) => {
  try {
    const { user_id, bet_amount } = req.body;
    if (!user_id || !bet_amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    const result = await OtherGamesService.playBowlingDuel(user_id, bet_amount);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing bowling:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

// ========== ФУТБОЛ API ==========

app.post("/api/games/football/goal", async (req, res) => {
  try {
    const { user_id, bet_amount } = req.body;
    if (!user_id || !bet_amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    const result = await OtherGamesService.playFootballGoal(user_id, bet_amount);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing football:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

app.post("/api/games/football/miss", async (req, res) => {
  try {
    const { user_id, bet_amount } = req.body;
    if (!user_id || !bet_amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    const result = await OtherGamesService.playFootballMiss(user_id, bet_amount);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing football:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

app.post("/api/games/football/not-hit", async (req, res) => {
  try {
    const { user_id, bet_amount } = req.body;
    if (!user_id || !bet_amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    const result = await OtherGamesService.playFootballNotHit(user_id, bet_amount);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing football not-hit:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

app.post("/api/games/football/hit", async (req, res) => {
  try {
    const { user_id, bet_amount } = req.body;
    if (!user_id || !bet_amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    const result = await OtherGamesService.playFootballHit(user_id, bet_amount);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing football hit:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

app.post("/api/games/football/duel", async (req, res) => {
  try {
    const { user_id, bet_amount } = req.body;
    if (!user_id || !bet_amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    const result = await OtherGamesService.playFootballDuel(user_id, bet_amount);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing football:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

// ========== БАСКЕТБОЛ API ==========

app.post("/api/games/basketball/goal", async (req, res) => {
  try {
    const { user_id, bet_amount } = req.body;
    if (!user_id || !bet_amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    const result = await OtherGamesService.playBasketballGoal(user_id, bet_amount);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing basketball:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

app.post("/api/games/basketball/miss", async (req, res) => {
  try {
    const { user_id, bet_amount } = req.body;
    if (!user_id || !bet_amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    const result = await OtherGamesService.playBasketballMiss(user_id, bet_amount);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing basketball:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

app.post("/api/games/basketball/not-hit", async (req, res) => {
  try {
    const { user_id, bet_amount } = req.body;
    if (!user_id || !bet_amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    const result = await OtherGamesService.playBasketballNotHit(user_id, bet_amount);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing basketball not-hit:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

app.post("/api/games/basketball/hit", async (req, res) => {
  try {
    const { user_id, bet_amount } = req.body;
    if (!user_id || !bet_amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    const result = await OtherGamesService.playBasketballHit(user_id, bet_amount);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing basketball hit:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

app.post("/api/games/basketball/duel", async (req, res) => {
  try {
    const { user_id, bet_amount } = req.body;
    if (!user_id || !bet_amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    const result = await OtherGamesService.playBasketballDuel(user_id, bet_amount);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing basketball duel:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

// ========== СЛОТЫ API ==========

app.post("/api/games/slots/play", async (req, res) => {
  try {
    const { user_id, bet_amount } = req.body;
    if (!user_id || !bet_amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    const result = await SlotsGameService.playSlots(user_id, bet_amount);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing slots:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

// ========== КАМЕНЬ-НОЖНИЦЫ-БУМАГА API ==========

app.post("/api/games/rps/play", async (req, res) => {
  try {
    const { user_id, bet_amount, choice } = req.body;
    if (!user_id || !bet_amount || !choice) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    if (!["rock", "paper", "scissors", "random"].includes(choice)) {
      return res.status(400).json({ success: false, error: "Invalid choice" });
    }

    const result = await RPSGameService.playRPS(user_id, bet_amount, choice);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing RPS:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

// ========== ДАРТС API ==========

app.post("/api/games/darts/red", async (req, res) => {
  try {
    const { user_id, bet_amount } = req.body;
    if (!user_id || !bet_amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    const result = await OtherGamesService.playDartsRed(user_id, bet_amount);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing darts:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

app.post("/api/games/darts/white", async (req, res) => {
  try {
    const { user_id, bet_amount } = req.body;
    if (!user_id || !bet_amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    const result = await OtherGamesService.playDartsWhite(user_id, bet_amount);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing darts:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

app.post("/api/games/darts/center", async (req, res) => {
  try {
    const { user_id, bet_amount } = req.body;
    if (!user_id || !bet_amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    const result = await OtherGamesService.playDartsCenter(user_id, bet_amount);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing darts:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

app.post("/api/games/darts/miss", async (req, res) => {
  try {
    const { user_id, bet_amount } = req.body;
    if (!user_id || !bet_amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    const result = await OtherGamesService.playDartsMiss(user_id, bet_amount);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing darts:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

// ============================================
// WITHDRAWAL API (via @send bot)
// ============================================

app.post("/api/withdraw", async (req, res) => {
  try {
    const { user_id, telegram_id, amount } = req.body;

    console.log(`💸 Запрос на вывод: user_id=${user_id}, telegram_id=${telegram_id}, amount=${amount}`);

    if (!user_id || !telegram_id || !amount) {
      console.error("❌ Отсутствуют обязательные поля");
      return res.status(400).json({ success: false, error: "Отсутствуют обязательные поля" });
    }

    const withdrawAmount = parseFloat(amount);

    if (isNaN(withdrawAmount) || withdrawAmount < 10) {
      console.error("❌ Некорректная сумма вывода:", withdrawAmount);
      return res.status(400).json({ success: false, error: "Минимальная сумма вывода: 10 USDT" });
    }

    // Проверяем баланс
    const balance = await BalanceModel.getBalance(user_id);
    console.log(`💰 Текущий баланс пользователя ${user_id}:`, balance?.balance);

    if (!balance || balance.balance < withdrawAmount) {
      console.error("❌ Недостаточно средств");
      return res.status(400).json({ success: false, error: "Недостаточно средств" });
    }

    // Получаем пользователя
    const user = await UserModel.getUserById(user_id);
    if (!user) {
      console.error("❌ Пользователь не найден");
      return res.status(400).json({ success: false, error: "Пользователь не найден" });
    }

    // Создаем транзакцию
    await TransactionModel.createTransaction(
      user_id,
      "withdrawal",
      withdrawAmount,
      "pending"
    );
    console.log(`✅ Транзакция на вывод создана`);

    // Вычитаем с баланса
    await BalanceModel.subtractBalance(user_id, withdrawAmount);
    console.log(`✅ Баланс обновлен`);

    // Получаем новый баланс
    const newBalance = await BalanceModel.getBalance(user_id);
    console.log(`💰 Новый баланс:`, newBalance?.balance);

    // Отправляем уведомление админу
    if (telegramBot) {
      const adminId = 5855297931;
      try {
        await telegramBot.sendMessage(
          adminId,
          `🔔 **Новая заявка на вывод**\n\nПользователь: ${user.first_name} (ID: ${telegram_id})\nСумма: ${withdrawAmount} USDT\n\n💸 Используйте @send для отправки средств пользователю по ID: \`${telegram_id}\``,
          { parse_mode: "Markdown" }
        );
        console.log(`✅ Уведомление админу отправлено`);
      } catch (err) {
        console.error("❌ Не удалось отправить уведомление админу:", err);
      }
    }

    res.json({
      success: true,
      newBalance: newBalance?.balance || 0,
      message: "Заявка на вывод создана"
    });
  } catch (error: any) {
    console.error("❌ Ошибка при обработке вывода:", error);
    res.status(500).json({ success: false, error: error.message || "Не удалось обработать заявку" });
  }
});

// ============================================
// CRYPTOBOT API ENDPOINTS
// ============================================

// Создать инвойс для пополнения (CryptoBot)
app.post("/api/crypto/create-invoice", async (req, res) => {
  try {
    const { user_id, amount } = req.body;

    console.log(`📝 Запрос на создание инвойса: user_id=${user_id}, amount=${amount}`);

    if (!user_id || !amount) {
      console.error("❌ Отсутствуют обязательные поля");
      return res.status(400).json({ success: false, error: "Отсутствуют обязательные поля" });
    }

    if (typeof amount !== 'number' || amount < 1) {
      console.error("❌ Некорректная сумма:", amount);
      return res.status(400).json({ success: false, error: "Некорректная сумма пополнения" });
    }

    const result = await cryptoBotService.createInvoice(user_id, amount);

    console.log(`📤 Результат создания инвойса:`, result);

    res.json(result);
  } catch (error: any) {
    console.error("❌ Ошибка при создании инвойса:", error);
    res.status(500).json({ success: false, error: error.message || "Не удалось создать счет" });
  }
});

// Вебхук для получения уведомлений от CryptoBot
app.post("/api/crypto/webhook", async (req, res) => {
  try {
    const invoiceData = req.body;
    console.log("CryptoBot webhook received:", invoiceData);

    const result = await cryptoBotService.processPayment(invoiceData);

    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, error: "Payment processing failed" });
    }
  } catch (error: any) {
    console.error("Error processing webhook:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// OLD CRYPTO API ENDPOINTS (TronWeb - deprecated)
// ============================================

// Получить адрес для пополнения
app.post("/api/crypto/deposit-address", async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) {
      return res.status(400).json({ success: false, error: "Missing user_id" });
    }
    const address = await cryptoService.getDepositAddress(user_id);
    res.json({ success: true, address });
  } catch (error: any) {
    console.error("Error getting deposit address:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to get deposit address" });
  }
});

// Проверить депозит
app.post("/api/crypto/check-deposit", async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) {
      return res.status(400).json({ success: false, error: "Missing user_id" });
    }
    const result = await cryptoService.checkDeposit(user_id);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Error checking deposit:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to check deposit" });
  }
});

// Обработать депозит (зачислить на баланс)
app.post("/api/crypto/process-deposit", async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) {
      return res.status(400).json({ success: false, error: "Missing user_id" });
    }
    const result = await cryptoService.processDeposit(user_id);
    res.json(result);
  } catch (error: any) {
    console.error("Error processing deposit:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to process deposit" });
  }
});

// Создать заявку на вывод
app.post("/api/crypto/withdraw", async (req, res) => {
  try {
    const { user_id, address, amount } = req.body;
    if (!user_id || !address || !amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const result = await cryptoService.withdrawUSDT(user_id, address, parseFloat(amount));
    res.json(result);
  } catch (error: any) {
    console.error("Error creating withdrawal:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to create withdrawal" });
  }
});

// ============================================
// ADMIN API ENDPOINTS
// ============================================

// Проверить является ли пользователь админом
app.get("/api/admin/check", async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ success: false, error: "Missing user_id" });
    }

    const isAdmin = await AdminModel.isAdmin(parseInt(user_id as string));
    const admin = await AdminModel.getAdminByUserId(parseInt(user_id as string));

    res.json({
      success: true,
      isAdmin,
      permissions: admin?.permissions || null
    });
  } catch (error: any) {
    console.error("Error checking admin:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Получить список ожидающих выводов (для админов)
app.get("/api/admin/pending-withdrawals", async (req, res) => {
  try {
    const { admin_id } = req.query;

    if (!admin_id) {
      return res.status(400).json({ success: false, error: "Missing admin_id" });
    }

    // Проверяем права админа
    const hasPermission = await AdminModel.hasPermission(parseInt(admin_id as string), "manage_withdrawals");
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    // Получаем pending withdrawals из базы
    const result = await TransactionModel.getPendingWithdrawals();

    res.json({ success: true, withdrawals: result });
  } catch (error: any) {
    console.error("Error getting pending withdrawals:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to get withdrawals" });
  }
});

// Отметить вывод как выполненный (админ уже отправил через @send)
app.post("/api/admin/withdrawals/:id/complete", async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_id } = req.body;

    if (!admin_id) {
      return res.status(400).json({ success: false, error: "Missing admin_id" });
    }

    // Проверяем права админа
    const hasPermission = await AdminModel.hasPermission(admin_id, "manage_withdrawals");
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    // Получаем транзакцию
    const transaction = await TransactionModel.getTransactionById(parseInt(id));

    if (!transaction || transaction.type !== "withdrawal") {
      return res.status(404).json({ success: false, error: "Transaction not found" });
    }

    if (transaction.status !== "pending") {
      return res.status(400).json({ success: false, error: "Transaction already processed" });
    }

    // Обновляем статус на completed
    await TransactionModel.updateTransactionStatus(
      parseInt(id),
      "completed",
      null,
      admin_id
    );

    // Уведомляем пользователя
    if (telegramBot) {
      const user = await UserModel.getUserById(transaction.user_id);
      if (user) {
        try {
          await telegramBot.sendMessage(
            user.telegram_id,
            `✅ **Вывод выполнен!**\n\nСумма: ${transaction.amount} USDT\n\nСредства отправлены на ваш Telegram ID через @send бота.`,
            { parse_mode: "Markdown" }
          );
        } catch (err) {
          console.error("Не удалось отправить уведомление пользователю:", err);
        }
      }
    }

    res.json({ success: true, message: "Withdrawal marked as completed" });
  } catch (error: any) {
    console.error("Error completing withdrawal:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to complete withdrawal" });
  }
});

// Получить статистику (для админов)
app.get("/api/admin/stats", async (req, res) => {
  try {
    const { admin_id } = req.query;

    if (!admin_id) {
      return res.status(400).json({ success: false, error: "Missing admin_id" });
    }

    // Проверяем права админа
    const hasPermission = await AdminModel.hasPermission(parseInt(admin_id as string), "view_stats");
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const totalUsers = await UserModel.getTotalUsers();
    const usersWithDeposits = await UserModel.getUsersWithDeposits();

    res.json({
      success: true,
      stats: {
        totalUsers,
        usersWithDeposits
      }
    });
  } catch (error: any) {
    console.error("Error getting stats:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Получить детальную статистику (для админов)
app.get("/api/admin/stats/detailed", async (req, res) => {
  try {
    const { admin_id } = req.query;

    console.log("📊 /api/admin/stats/detailed: Запрос от admin_id =", admin_id);

    if (!admin_id) {
      console.error("❌ /api/admin/stats/detailed: Missing admin_id");
      return res.status(400).json({ success: false, error: "Missing admin_id" });
    }

    // Проверяем права админа
    console.log("🔐 Проверяем права администратора для user_id =", admin_id);
    const hasPermission = await AdminModel.hasPermission(parseInt(admin_id as string), "view_stats");
    if (!hasPermission) {
      console.error("❌ /api/admin/stats/detailed: Access denied для user_id =", admin_id);
      return res.status(403).json({ success: false, error: "Access denied: недостаточно прав для просмотра статистики" });
    }

    console.log("✅ Права администратора подтверждены");

    // Общая статистика пользователей
    console.log("📊 Получаем общую статистику пользователей...");
    const totalUsersResult = await pool.query("SELECT COUNT(*) as count FROM users");
    const totalUsers = parseInt(totalUsersResult.rows[0].count);
    console.log("✅ Всего пользователей:", totalUsers);

    const usersWithDepositsResult = await pool.query(
      "SELECT COUNT(DISTINCT user_id) as count FROM transactions WHERE type = 'deposit' AND status = 'completed'"
    );
    const usersWithDeposits = parseInt(usersWithDepositsResult.rows[0].count);
    console.log("✅ Пользователей с депозитами:", usersWithDeposits);

    // Депозиты и выводы за месяц по дням
    console.log("📊 Получаем транзакции за последние 30 дней...");
    const transactionsPerDayResult = await pool.query(
      `SELECT
        created_at::date as date,
        type,
        COUNT(*) as count,
        SUM(amount) as total_amount
       FROM transactions
       WHERE created_at >= NOW() - INTERVAL '30 days'
       AND status = 'completed'
       GROUP BY created_at::date, type
       ORDER BY created_at::date DESC`
    );

    const transactionsPerDay = transactionsPerDayResult.rows.map(row => ({
      date: row.date,
      type: row.type,
      count: parseInt(row.count),
      total_amount: parseFloat(row.total_amount),
    }));
    console.log("✅ Получено транзакций за месяц:", transactionsPerDay.length);

    // Топ пользователей по депозитам
    console.log("📊 Получаем топ пользователей...");
    const topUsersResult = await pool.query(
      `SELECT
        u.id,
        u.username,
        u.first_name,
        u.created_at,
        COALESCE(MAX(b.total_deposited), 0) as total_deposited,
        COALESCE(MAX(b.total_withdrawn), 0) as total_withdrawn,
        COALESCE(MAX(b.balance), 0) as balance,
        COUNT(DISTINCT t.id) as total_transactions
       FROM users u
       LEFT JOIN balances b ON u.id = b.user_id
       LEFT JOIN transactions t ON u.id = t.user_id
       GROUP BY u.id, u.username, u.first_name, u.created_at
       ORDER BY MAX(b.total_deposited) DESC NULLS LAST
       LIMIT 50`
    );

    const topUsers = topUsersResult.rows.map(row => ({
      id: row.id,
      username: row.username,
      first_name: row.first_name,
      created_at: row.created_at,
      total_deposited: parseFloat(row.total_deposited) || 0,
      total_withdrawn: parseFloat(row.total_withdrawn) || 0,
      balance: parseFloat(row.balance) || 0,
      total_transactions: parseInt(row.total_transactions) || 0,
    }));
    console.log("✅ Получено топ пользователей:", topUsers.length);

    // Статистика игр
    console.log("📊 Получаем статистику игр...");
    const gamesStatsResult = await pool.query(
      `SELECT
        g.id,
        g.name,
        g.type,
        COUNT(gh.id) as total_plays,
        SUM(CASE WHEN gh.is_win THEN 1 ELSE 0 END) as total_wins,
        SUM(CASE WHEN gh.is_win THEN 0 ELSE 1 END) as total_losses,
        SUM(gh.bet_amount) as total_bet,
        SUM(gh.win_amount) as total_win,
        ROUND(AVG(CASE WHEN gh.is_win THEN 100 ELSE 0 END), 2) as win_rate
       FROM games g
       LEFT JOIN game_history gh ON g.id = gh.game_id
       GROUP BY g.id, g.name, g.type
       ORDER BY total_plays DESC`
    );

    const gamesStats = gamesStatsResult.rows.map(row => ({
      id: row.id,
      name: row.name,
      type: row.type,
      total_plays: parseInt(row.total_plays) || 0,
      total_wins: parseInt(row.total_wins) || 0,
      total_losses: parseInt(row.total_losses) || 0,
      total_bet: parseFloat(row.total_bet) || 0,
      total_win: parseFloat(row.total_win) || 0,
      win_rate: parseFloat(row.win_rate) || 0,
    }));
    console.log("✅ Получена статистика по играм:", gamesStats.length);

    // Общее количество игр
    console.log("📊 Получаем общее количество игр...");
    const totalGamesResult = await pool.query("SELECT COUNT(*) as count FROM game_history");
    const totalGames = parseInt(totalGamesResult.rows[0]?.count || 0);
    console.log("✅ Всего игр сыграно:", totalGames);

    // Общая сумма депозитов
    console.log("📊 Получаем общую сумму депозитов...");
    const totalDepositsResult = await pool.query(
      "SELECT SUM(amount) as total FROM transactions WHERE type = 'deposit' AND status = 'completed'"
    );
    const totalDeposits = parseFloat(totalDepositsResult.rows[0]?.total || 0);
    console.log("✅ Общая сумма депозитов:", totalDeposits);

    // Общая сумма выводов
    console.log("📊 Получаем общую сумму выводов...");
    const totalWithdrawalsResult = await pool.query(
      "SELECT SUM(amount) as total FROM transactions WHERE type = 'withdrawal' AND status = 'completed'"
    );
    const totalWithdrawals = parseFloat(totalWithdrawalsResult.rows[0]?.total || 0);
    console.log("✅ Общая сумма выводов:", totalWithdrawals);

    // Активные пользователи сегодня
    console.log("📊 Получаем активных пользователей сегодня...");
    const activeUsersTodayResult = await pool.query(
      "SELECT COUNT(DISTINCT user_id) as count FROM game_history WHERE played_at::date = CURRENT_DATE"
    );
    const activeUsersToday = parseInt(activeUsersTodayResult.rows[0]?.count || 0);
    console.log("✅ Активных пользователей сегодня:", activeUsersToday);

    console.log("✅ Все данные статистики получены успешно");

    res.json({
      success: true,
      stats: {
        totalUsers,
        usersWithDeposits,
        totalGames,
        totalDeposits,
        totalWithdrawals,
        activeUsersToday,
        transactionsPerDay,
        topUsers,
        gamesStats,
      }
    });
  } catch (error: any) {
    console.error("❌ КРИТИЧЕСКАЯ ОШИБКА в /api/admin/stats/detailed:");
    console.error("❌ Тип ошибки:", error.constructor.name);
    console.error("❌ Сообщение ошибки:", error.message);
    console.error("❌ Stack trace:", error.stack);

    // Дополнительные детали для SQL ошибок
    if (error.code) {
      console.error("❌ SQL код ошибки:", error.code);
    }
    if (error.detail) {
      console.error("❌ SQL детали:", error.detail);
    }
    if (error.hint) {
      console.error("❌ SQL подсказка:", error.hint);
    }

    // Формируем подробное сообщение для клиента
    let errorMessage = error.message || "Неизвестная ошибка сервера";
    if (error.code) {
      errorMessage += ` (SQL код: ${error.code})`;
    }
    if (error.detail) {
      errorMessage += `\nДетали: ${error.detail}`;
    }

    res.status(500).json({
      success: false,
      error: errorMessage,
      errorType: error.constructor.name
    });
  }
});

// Получить детальную информацию о конкретном пользователе (для админов)
app.get("/api/admin/user/:user_id", async (req, res) => {
  try {
    const { admin_id } = req.query;
    const { user_id } = req.params;

    if (!admin_id) {
      return res.status(400).json({ success: false, error: "Missing admin_id" });
    }

    // Проверяем права админа
    const hasPermission = await AdminModel.hasPermission(parseInt(admin_id as string), "view_stats");
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const searchId = parseInt(user_id);

    if (isNaN(searchId) || searchId <= 0) {
      console.log(`❌ Некорректный ID: ${user_id}`);
      return res.status(400).json({ success: false, error: "Invalid user ID" });
    }

    console.log(`🔍 Поиск пользователя по ID: ${searchId}`);

    // Пробуем найти пользователя по database ID
    let user = await UserModel.getUserById(searchId);
    console.log(`📊 Поиск по database ID ${searchId}:`, user ? 'найден' : 'не найден');

    // Если не найден, пробуем найти по telegram_id
    if (!user) {
      user = await UserModel.findByTelegramId(searchId);
      console.log(`📊 Поиск по telegram_id ${searchId}:`, user ? 'найден' : 'не найден');
    }

    if (!user) {
      console.log(`❌ Пользователь ${searchId} не найден ни по database ID, ни по telegram_id`);
      return res.status(404).json({ success: false, error: "User not found" });
    }

    console.log(`✅ Пользователь найден: ID=${user.id}, telegram_id=${user.telegram_id}, имя=${user.first_name}`);

    // Баланс
    const balance = await BalanceModel.getBalance(user.id);

    // Транзакции
    const transactions = await TransactionModel.getUserTransactions(user.id, 100);

    // История игр
    const gamesHistory = await GameModel.getUserGameHistory(user.id);

    // Подсчёт статистики игр
    const gamesCount = gamesHistory.length;
    const winsCount = gamesHistory.filter((game: any) => game.is_win).length;
    const totalBets = gamesHistory.reduce((sum: number, game: any) => sum + parseFloat(game.bet_amount || 0), 0);
    const totalWins = gamesHistory.reduce((sum: number, game: any) => sum + parseFloat(game.win_amount || 0), 0);

    res.json({
      success: true,
      user: {
        ...user,
        balance: balance ? parseFloat(balance.balance.toString()) : 0,
        total_deposited: balance ? parseFloat(balance.total_deposited.toString()) : 0,
        total_withdrawn: balance ? parseFloat(balance.total_withdrawn.toString()) : 0,
      },
      balance: balance ? parseFloat(balance.balance.toString()) : 0,
      transactions,
      gamesHistory,
      stats: {
        games_count: gamesCount,
        wins_count: winsCount,
        total_bets: totalBets,
        total_wins: totalWins
      }
    });
  } catch (error: any) {
    console.error("Error getting user details:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Заблокировать/разблокировать пользователя (для админов)
app.post("/api/admin/user/:user_id/block", async (req, res) => {
  try {
    const { admin_id, is_blocked } = req.body;
    const { user_id } = req.params;

    if (!admin_id) {
      return res.status(400).json({ success: false, error: "Missing admin_id" });
    }

    const hasPermission = await AdminModel.hasPermission(parseInt(admin_id), "manage_users");
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    await UserModel.updateUser(parseInt(user_id), { is_blocked });

    res.json({
      success: true,
      message: is_blocked ? "User blocked" : "User unblocked"
    });
  } catch (error: any) {
    console.error("Error blocking user:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Редактировать баланс пользователя (для админов)
app.post("/api/admin/user/:user_id/edit-balance", async (req, res) => {
  try {
    const { admin_id, amount, operation } = req.body;
    const { user_id } = req.params;

    if (!admin_id || !amount || !operation) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const hasPermission = await AdminModel.hasPermission(parseInt(admin_id), "manage_users");
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const parsedAmount = parseFloat(amount);

    if (operation === "add") {
      await BalanceModel.addBalance(parseInt(user_id), parsedAmount);
    } else if (operation === "subtract") {
      await BalanceModel.subtractBalance(parseInt(user_id), parsedAmount);
    } else if (operation === "set") {
      // Установить точное значение баланса
      const currentBalance = await BalanceModel.getBalance(parseInt(user_id));
      if (currentBalance) {
        const diff = parsedAmount - parseFloat(currentBalance.balance.toString());
        if (diff > 0) {
          await BalanceModel.addBalance(parseInt(user_id), diff);
        } else if (diff < 0) {
          await BalanceModel.subtractBalance(parseInt(user_id), Math.abs(diff));
        }
      }
    }

    const newBalance = await BalanceModel.getBalance(parseInt(user_id));

    res.json({
      success: true,
      newBalance: newBalance ? parseFloat(newBalance.balance.toString()) : 0
    });
  } catch (error: any) {
    console.error("Error editing balance:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// BROADCAST API ENDPOINTS
// ============================================

// Создать рассылку (для админов)
app.post("/api/admin/broadcast/create", async (req, res) => {
  try {
    const { admin_id, message_text, media_url, media_type } = req.body;

    if (!admin_id || !message_text) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const hasPermission = await AdminModel.hasPermission(parseInt(admin_id), "manage_users");
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const broadcast = await BroadcastModel.create(
      parseInt(admin_id),
      message_text,
      media_url,
      media_type
    );

    res.json({
      success: true,
      broadcast
    });
  } catch (error: any) {
    console.error("Error creating broadcast:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Отправить рассылку (для админов)
app.post("/api/admin/broadcast/:broadcast_id/send", async (req, res) => {
  try {
    const { admin_id } = req.body;
    const { broadcast_id } = req.params;

    if (!admin_id) {
      return res.status(400).json({ success: false, error: "Missing admin_id" });
    }

    const hasPermission = await AdminModel.hasPermission(parseInt(admin_id), "manage_users");
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    // Подготавливаем рассылку
    await BroadcastModel.sendBroadcast(parseInt(broadcast_id));

    // Запускаем отправку в фоновом режиме
    if (telegramBot) {
      const broadcastService = new BroadcastService(telegramBot.getBot());
      broadcastService.startBroadcast(parseInt(broadcast_id));
    }

    res.json({
      success: true,
      message: "Broadcast started"
    });
  } catch (error: any) {
    console.error("Error sending broadcast:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Получить список рассылок (для админов)
app.get("/api/admin/broadcasts", async (req, res) => {
  try {
    const { admin_id, limit, offset } = req.query;

    if (!admin_id) {
      return res.status(400).json({ success: false, error: "Missing admin_id" });
    }

    const hasPermission = await AdminModel.hasPermission(parseInt(admin_id as string), "manage_users");
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const broadcasts = await BroadcastModel.getAll(
      limit ? parseInt(limit as string) : 50,
      offset ? parseInt(offset as string) : 0
    );

    res.json({
      success: true,
      broadcasts
    });
  } catch (error: any) {
    console.error("Error getting broadcasts:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Получить статистику рассылки (для админов)
app.get("/api/admin/broadcast/:broadcast_id/stats", async (req, res) => {
  try {
    const { admin_id } = req.query;
    const { broadcast_id } = req.params;

    if (!admin_id) {
      return res.status(400).json({ success: false, error: "Missing admin_id" });
    }

    const hasPermission = await AdminModel.hasPermission(parseInt(admin_id as string), "manage_users");
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const stats = await BroadcastModel.getStats(parseInt(broadcast_id));
    const broadcast = await BroadcastModel.getById(parseInt(broadcast_id));

    res.json({
      success: true,
      broadcast,
      stats
    });
  } catch (error: any) {
    console.error("Error getting broadcast stats:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// SETTINGS API ENDPOINTS
// ============================================

// Получить все настройки (для админов)
app.get("/api/admin/settings", async (req, res) => {
  try {
    const { admin_id } = req.query;

    if (!admin_id) {
      return res.status(400).json({ success: false, error: "Missing admin_id" });
    }

    const hasPermission = await AdminModel.hasPermission(parseInt(admin_id as string), "manage_settings");
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const result = await pool.query("SELECT * FROM settings ORDER BY key");

    res.json({
      success: true,
      settings: result.rows
    });
  } catch (error: any) {
    console.error("Error getting settings:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Обновить настройку (для админов)
app.post("/api/admin/settings/:key", async (req, res) => {
  try {
    const { admin_id, value } = req.body;
    const { key } = req.params;

    if (!admin_id || value === undefined) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const hasPermission = await AdminModel.hasPermission(parseInt(admin_id), "manage_settings");
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    await pool.query(
      `UPDATE settings SET value = $1, updated_at = NOW() WHERE key = $2`,
      [value, key]
    );

    res.json({
      success: true,
      message: "Setting updated"
    });
  } catch (error: any) {
    console.error("Error updating setting:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Обновить RTP игры (для админов)
app.post("/api/admin/games/:game_id/rtp", async (req, res) => {
  try {
    const { admin_id, rtp } = req.body;
    const { game_id } = req.params;

    if (!admin_id || rtp === undefined) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const hasPermission = await AdminModel.hasPermission(parseInt(admin_id), "manage_settings");
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const rtpValue = parseFloat(rtp);
    if (rtpValue < 0 || rtpValue > 100) {
      return res.status(400).json({ success: false, error: "RTP must be between 0 and 100" });
    }

    await pool.query(
      `UPDATE games SET rtp = $1 WHERE id = $2`,
      [rtpValue, parseInt(game_id)]
    );

    res.json({
      success: true,
      message: "RTP updated"
    });
  } catch (error: any) {
    console.error("Error updating RTP:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Включить/выключить игру (для админов)
app.post("/api/admin/games/:game_id/toggle", async (req, res) => {
  try {
    const { admin_id, is_active } = req.body;
    const { game_id } = req.params;

    if (!admin_id || is_active === undefined) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const hasPermission = await AdminModel.hasPermission(parseInt(admin_id), "manage_settings");
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    await pool.query(
      `UPDATE games SET is_active = $1 WHERE id = $2`,
      [is_active, parseInt(game_id)]
    );

    res.json({
      success: true,
      message: is_active ? "Game enabled" : "Game disabled"
    });
  } catch (error: any) {
    console.error("Error toggling game:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// ADMIN: Настройки дуэлей между игроками
// ========================================

// Получить настройки дуэлей
app.get("/api/admin/duel-settings", async (req, res) => {
  try {
    const { admin_id } = req.query;

    if (!admin_id) {
      return res.status(400).json({ success: false, error: "Missing admin_id" });
    }

    const hasPermission = await AdminModel.hasPermission(parseInt(admin_id as string), "manage_settings");
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const commissionQuery = await pool.query(
      "SELECT value FROM settings WHERE key = 'duel_commission_rate'"
    );
    const guaranteedWinQuery = await pool.query(
      "SELECT value FROM settings WHERE key = 'duel_guaranteed_win_user_id'"
    );

    res.json({
      success: true,
      commission_rate: parseFloat(commissionQuery.rows[0]?.value || '9.00'),
      guaranteed_win_user_id: parseInt(guaranteedWinQuery.rows[0]?.value || '0')
    });
  } catch (error: any) {
    console.error("Error fetching duel settings:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Обновить процент комиссии дуэлей
app.post("/api/admin/duel-settings/commission", async (req, res) => {
  try {
    const { admin_id, commission_rate } = req.body;

    if (!admin_id || commission_rate === undefined) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    if (commission_rate < 0 || commission_rate > 50) {
      return res.status(400).json({ success: false, error: "Commission rate must be between 0 and 50" });
    }

    const hasPermission = await AdminModel.hasPermission(parseInt(admin_id), "manage_settings");
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    await pool.query(
      `UPDATE settings SET value = $1, updated_at = CURRENT_TIMESTAMP WHERE key = 'duel_commission_rate'`,
      [commission_rate.toString()]
    );

    res.json({
      success: true,
      message: `Duel commission rate updated to ${commission_rate}%`
    });
  } catch (error: any) {
    console.error("Error updating duel commission:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Установить гарантированного победителя дуэлей
app.post("/api/admin/duel-settings/guaranteed-win", async (req, res) => {
  try {
    const { admin_id, user_id } = req.body;

    if (!admin_id || user_id === undefined) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const hasPermission = await AdminModel.hasPermission(parseInt(admin_id), "manage_settings");
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    // Проверяем что пользователь существует (если не 0)
    if (user_id !== 0) {
      const user = await UserModel.getUserById(user_id);
      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }
    }

    await pool.query(
      `UPDATE settings SET value = $1, updated_at = CURRENT_TIMESTAMP WHERE key = 'duel_guaranteed_win_user_id'`,
      [user_id.toString()]
    );

    res.json({
      success: true,
      message: user_id === 0 ? "Guaranteed wins disabled" : `User ${user_id} will now win all duels`
    });
  } catch (error: any) {
    console.error("Error updating guaranteed win setting:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// DUEL API ENDPOINTS
// ============================================

// Создать комнату для дуэли
app.post("/api/duels/create", async (req, res) => {
  try {
    const { user_id, game_name, mode_name, bet_amount } = req.body;

    if (!user_id || !game_name || !mode_name || !bet_amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const result = await DuelService.createDuelRoom(user_id, game_name, mode_name, parseFloat(bet_amount));

    // Отправляем уведомление создателю
    if (result.success && telegramBot && result.room_code) {
      const user = await UserModel.getUserById(user_id);
      if (user) {
        await telegramBot.sendMessage(
          user.telegram_id,
          `✅ Комната создана!\n\n🎮 Игра: ${game_name}\n🎯 Режим: ${mode_name}\n💰 Ставка: ${bet_amount} USDT\n\n🔑 Код комнаты: \`${result.room_code}\`\n\nОтправьте этот код оппоненту или ждите присоединения.`,
          { parse_mode: "Markdown" }
        );
      }
    }

    res.json(result);
  } catch (error: any) {
    console.error("Error creating duel:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to create duel" });
  }
});

// Присоединиться к комнате
app.post("/api/duels/join", async (req, res) => {
  try {
    const { user_id, room_code } = req.body;

    if (!user_id || !room_code) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const result = await DuelService.joinDuelRoom(user_id, room_code);

    // Отправляем уведомления обоим игрокам
    if (result.success && result.duel && telegramBot) {
      const creator = await UserModel.getUserById(result.duel.creator_id);
      const opponent = await UserModel.getUserById(user_id);

      if (creator) {
        await telegramBot.sendMessage(
          creator.telegram_id,
          `🎮 Противник присоединился!\n\n👤 Игрок: ${opponent?.first_name || "Игрок"}\n💰 Ставка: ${result.duel.bet_amount} USDT\n\n🎯 Сделайте свой ход в Mini App!`
        );
      }

      if (opponent) {
        await telegramBot.sendMessage(
          opponent.telegram_id,
          `✅ Вы присоединились к дуэли!\n\n🎮 Игра: ${result.duel.mode_name}\n💰 Ставка: ${result.duel.bet_amount} USDT\n👤 Противник: ${creator?.first_name || "Игрок"}\n\n🎯 Сделайте свой ход в Mini App!`
        );
      }
    }

    res.json(result);
  } catch (error: any) {
    console.error("Error joining duel:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to join duel" });
  }
});

// Получить информацию о дуэли
app.get("/api/duels/:duel_id", async (req, res) => {
  try {
    const { duel_id } = req.params;
    const duel = await DuelService.getDuel(parseInt(duel_id));

    if (!duel) {
      return res.status(404).json({ success: false, error: "Duel not found" });
    }

    res.json({ success: true, duel });
  } catch (error: any) {
    console.error("Error getting duel:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to get duel" });
  }
});

// Получить дуэль по коду комнаты
app.get("/api/duels/room/:room_code", async (req, res) => {
  try {
    const { room_code } = req.params;
    const duel = await DuelService.getDuelByRoomCode(room_code);

    if (!duel) {
      return res.status(404).json({ success: false, error: "Room not found" });
    }

    res.json({ success: true, duel });
  } catch (error: any) {
    console.error("Error getting duel by room code:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to get duel" });
  }
});

// Сыграть в дуэли
app.post("/api/duels/:duel_id/play", async (req, res) => {
  try {
    const { duel_id } = req.params;
    const { user_id, result } = req.body;

    if (!user_id || !result) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const playResult = await DuelService.playDuel(user_id, parseInt(duel_id), result);

    // Если дуэль завершена, отправляем уведомления
    if (playResult.success && playResult.winner && telegramBot) {
      const duel = await DuelService.getDuel(parseInt(duel_id));
      if (duel) {
        const creator = await UserModel.getUserById(duel.creator_id);
        const opponent = await UserModel.getUserById(duel.opponent_id!);
        const prize = duel.bet_amount * 2 * 0.95;

        if (playResult.winner === "draw") {
          // Ничья
          if (creator) {
            await telegramBot.sendMessage(
              creator.telegram_id,
              `🤝 Дуэль завершена!\n\n🎯 Результат: Ничья\n💰 Возврат: ${duel.bet_amount} USDT`
            );
          }
          if (opponent) {
            await telegramBot.sendMessage(
              opponent.telegram_id,
              `🤝 Дуэль завершена!\n\n🎯 Результат: Ничья\n💰 Возврат: ${duel.bet_amount} USDT`
            );
          }
        } else {
          const isCreatorWinner = playResult.winner === "creator";
          const winner = isCreatorWinner ? creator : opponent;
          const loser = isCreatorWinner ? opponent : creator;

          if (winner) {
            await telegramBot.sendMessage(
              winner.telegram_id,
              `🎉 Победа в дуэли!\n\n💰 Выигрыш: +${prize.toFixed(2)} USDT\n🎯 Комиссия: 5%`
            );
          }
          if (loser) {
            await telegramBot.sendMessage(
              loser.telegram_id,
              `😔 Поражение в дуэли\n\n💸 Проигрыш: -${duel.bet_amount} USDT\n\nПопробуйте еще раз!`
            );
          }
        }
      }
    }

    res.json(playResult);
  } catch (error: any) {
    console.error("Error playing duel:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play duel" });
  }
});

// Отменить дуэль
app.post("/api/duels/:duel_id/cancel", async (req, res) => {
  try {
    const { duel_id } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ success: false, error: "Missing user_id" });
    }

    const result = await DuelService.cancelDuel(user_id, parseInt(duel_id));
    res.json(result);
  } catch (error: any) {
    console.error("Error cancelling duel:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to cancel duel" });
  }
});

// Получить активные дуэли пользователя
app.get("/api/duels/user/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;
    const duels = await DuelService.getUserDuels(parseInt(user_id));
    res.json({ success: true, duels });
  } catch (error: any) {
    console.error("Error getting user duels:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to get user duels" });
  }
});

// ============================================
// OTHER GAMES PVP DUELS API (Bowling, Football, Basketball)
// ============================================

// Создать PvP дуэль
app.post("/api/other-duels/create", async (req, res) => {
  try {
    const { user_id, game_type, mode_name, bet_amount } = req.body;

    if (!user_id || !game_type || !mode_name || !bet_amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    if (!['bowling', 'football', 'basketball'].includes(game_type)) {
      return res.status(400).json({ success: false, error: "Invalid game type" });
    }

    const result = await OtherGamesDuelService.createDuelRoom(
      user_id,
      game_type as 'bowling' | 'football' | 'basketball',
      mode_name,
      parseFloat(bet_amount)
    );

    res.json(result);
  } catch (error: any) {
    console.error("Error creating other game duel:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to create duel" });
  }
});

// Присоединиться к PvP дуэли
app.post("/api/other-duels/join", async (req, res) => {
  try {
    const { user_id, room_code } = req.body;

    if (!user_id || !room_code) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const result = await OtherGamesDuelService.joinDuelRoom(user_id, room_code);
    res.json(result);
  } catch (error: any) {
    console.error("Error joining other game duel:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to join duel" });
  }
});

// Сыграть в PvP дуэли
app.post("/api/other-duels/:duel_id/play", async (req, res) => {
  try {
    const { duel_id } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ success: false, error: "Missing user_id" });
    }

    const result = await OtherGamesDuelService.playDuel(user_id, parseInt(duel_id));
    res.json(result);
  } catch (error: any) {
    console.error("Error playing other game duel:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play duel" });
  }
});

// Получить информацию о дуэли
app.get("/api/other-duels/:duel_id", async (req, res) => {
  try {
    const { duel_id } = req.params;
    const duel = await OtherGamesDuelService.getDuel(parseInt(duel_id));

    if (!duel) {
      return res.status(404).json({ success: false, error: "Duel not found" });
    }

    res.json({ success: true, duel });
  } catch (error: any) {
    console.error("Error getting duel:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to get duel" });
  }
});

// Получить дуэль по коду комнаты
app.get("/api/other-duels/room/:room_code", async (req, res) => {
  try {
    const { room_code } = req.params;
    const duel = await OtherGamesDuelService.getDuelByRoomCode(room_code);

    if (!duel) {
      return res.status(404).json({ success: false, error: "Room not found" });
    }

    res.json({ success: true, duel });
  } catch (error: any) {
    console.error("Error getting duel by room code:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to get duel" });
  }
});

// Отменить дуэль
app.post("/api/other-duels/:duel_id/cancel", async (req, res) => {
  try {
    const { duel_id } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ success: false, error: "Missing user_id" });
    }

    const result = await OtherGamesDuelService.cancelDuel(user_id, parseInt(duel_id));
    res.json(result);
  } catch (error: any) {
    console.error("Error cancelling duel:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to cancel duel" });
  }
});

// Получить доступные дуэли для игры
app.get("/api/other-duels/available/:game_type", async (req, res) => {
  try {
    const { game_type } = req.params;

    if (!['bowling', 'football', 'basketball'].includes(game_type)) {
      return res.status(400).json({ success: false, error: "Invalid game type" });
    }

    const duels = await OtherGamesDuelService.getAvailableDuels(game_type as 'bowling' | 'football' | 'basketball');
    res.json({ success: true, duels });
  } catch (error: any) {
    console.error("Error getting available duels:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to get duels" });
  }
});

// Получить активные дуэли пользователя
app.get("/api/other-duels/user/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;
    const duels = await OtherGamesDuelService.getUserDuels(parseInt(user_id));
    res.json({ success: true, duels });
  } catch (error: any) {
    console.error("Error getting user duels:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to get user duels" });
  }
});

// ============================================
// USER STATS API ENDPOINTS
// ============================================

// Получить детальную статистику пользователя
app.get("/api/user/:user_id/stats", async (req, res) => {
  try {
    const { user_id } = req.params;
    const userId = parseInt(user_id);

    const user = await UserModel.getUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Вычисляем дни с регистрации
    const daysWithBot = Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24));

    // Получаем статистику из user_stats
    const statsResult = await pool.query(
      `SELECT
        us.*,
        g.name as favorite_game_name,
        g.type as favorite_game_type
       FROM user_stats us
       LEFT JOIN games g ON us.favorite_game_id = g.id
       WHERE us.user_id = $1`,
      [userId]
    );

    let stats = {
      total_games: 0,
      total_wins: 0,
      total_losses: 0,
      total_bet_amount: 0,
      total_win_amount: 0,
      biggest_win: 0,
      favorite_game_name: null,
      favorite_game_type: null,
    };

    if (statsResult.rows.length > 0) {
      const row = statsResult.rows[0];
      stats = {
        total_games: parseInt(row.total_games) || 0,
        total_wins: parseInt(row.total_wins) || 0,
        total_losses: parseInt(row.total_losses) || 0,
        total_bet_amount: parseFloat(row.total_bet_amount) || 0,
        total_win_amount: parseFloat(row.total_win_amount) || 0,
        biggest_win: parseFloat(row.biggest_win) || 0,
        favorite_game_name: row.favorite_game_name,
        favorite_game_type: row.favorite_game_type,
      };
    }

    // Получаем историю последних игр
    const historyResult = await pool.query(
      `SELECT
        gh.*,
        g.name as game_name,
        g.type as game_type
       FROM game_history gh
       JOIN games g ON gh.game_id = g.id
       WHERE gh.user_id = $1
       ORDER BY gh.played_at DESC
       LIMIT 10`,
      [userId]
    );

    const history = historyResult.rows.map(row => ({
      game_name: row.game_name,
      game_type: row.game_type,
      bet_amount: parseFloat(row.bet_amount),
      win_amount: parseFloat(row.win_amount),
      is_win: row.is_win,
      result: row.result,
      played_at: row.played_at,
    }));

    res.json({
      success: true,
      daysWithBot,
      stats,
      history,
    });
  } catch (error: any) {
    console.error("Error getting user stats:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to get user stats" });
  }
});

// ============================================
// REFERRAL API ENDPOINTS
// ============================================

// Получить реферальную статистику пользователя
app.get("/api/referrals/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;
    const userId = parseInt(user_id);

    const user = await UserModel.getUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const { ReferralModel } = await import("../models/Referral");
    const stats = await ReferralModel.getReferralStats(userId);

    // Получаем имя бота для ссылки
    const botUsername = process.env.BOT_USERNAME || "jokerycasino_bot";
    const referralLink = `https://t.me/${botUsername}?start=${user.telegram_id}`;

    res.json({
      success: true,
      referralLink,
      stats
    });
  } catch (error: any) {
    console.error("Error getting referral stats:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to get referral stats" });
  }
});

export function startServer(port: number) {
  app.listen(port, "0.0.0.0", () => {
    console.log(`🚀 Сервер запущен на порту ${port}`);
    startKeepAlive(port);
  });
}

const PORT = 5000;
if (require.main === module) {
  startServer(PORT);
}

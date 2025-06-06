# gptbot
Телеграм-бот, работающий на воркерах cloudflare, включающий все LLM-модели openrouter
## Развёртывание:
Вам понадобится:
1. Учётная запись cloudflare - https://dash.cloudflare.com/login
2. Учётная запись openrouter, желательно с положительным балансом и API токен от неё - https://openrouter.ai/settings/keys
3. Учётная запись telegram
4. Для работы веб поиска - api токен для поиска google + его ID, получить можно здесь: https://programmablesearchengine.google.com/controlpanel/all?hl=ru

## 1. Создаём бота в телеграмм:
### Переходим авторизованной учёткой в @BotFather и отправляем команду /newbot
### Даём имя нашему новому боту, по которому он будет доступен в телеграмм. Например usernamecloudgptbot - оно обязательно должно заканчиваться на bot
### Из ответного сообщения об успешной регистрации записываем токен.
## 2. Получаем наш id в телеграмме для работы белого списка. Переходим в @getmyid_bot
### Нажимаем  /start
### Записываем свой userId
## 3. Скачиваем файлы гитхаб проекта в папку на пк (https://github.com/Alfirine/gptbot/archive/refs/heads/main.zip или же git clone https://github.com/Alfirine/gptbot в консоли)
## 4. Авторизуемся на cloudflare. Переходим в раздел Compute(Workers) Workers & Pages
![image](https://github.com/user-attachments/assets/8a7b8b64-738a-4282-8a9a-cbc28c19927c)
### Нажимаем create, Start with Hello World!
### Даём название нашему боту - gptbot
### Нажимаем deploy
### Нажимаем edit code
### Нажимаем в верхнем левом углу на значок Explorer (или же сочетание клавиш ctrl + shift + E)
![image](https://github.com/user-attachments/assets/2f0b1142-7cd9-44ba-ac24-bf498601b998)
### Открываем директорию с загруженными из репозитория файлами, выделяем их все и перетаскиваем с заменой файла worker.js). 
### Нажимаем стрелку с названием вашего бота в верхнем левом углу. Попадаем в общую конфигурацию воркера. Нажимаем кнопку settings
![image](https://github.com/user-attachments/assets/b7d38186-0adf-4ac1-966d-93faeeb36e7d)
### В блоке Variables and Secrets добавляем переменные (типа plaintext или secret - на ваше усмотрение, влияет на видимость значений)
### API_KEY - здесь указываем API токен от openrouter
### BOT_NAME - здесь указываем имя вашего бота в телеграмме, вида @cloudgptbot
### CHAT_WHITE_LIST - здесь указываем ранее полученный id учётной записи телеграмма (также, если хотите расшарить доступ для нескольких пользователей - можно указать через запятую)
### TELEGRAM_TOKEN - здесь указываем токен нашего телеграм-бота, полученный от botfather
### Опционально - можно добавить параметры GOOGLE_API_KEY, GOOGLE_SEARCH_ENGINE_ID
### Нажимаем deploy, после чего в верхнем правом углу на кнопку view this worker
![image](https://github.com/user-attachments/assets/109aff9a-29ea-4b72-b02f-1ecddda875bb)
### На открывшейся странице нажимаем кнопку click here для привязки вебхука.
![image](https://github.com/user-attachments/assets/d23db72c-0e4f-4f1d-914d-5b1db27431ea)
### Переходим в телеграмм, поиском находим нашего нового бота и добавляем к себе. 

### Команда /models позволяет выбрать определенную модель. Напротив названия модели будет указана цена за миллион входящих и исходящих токенов, в долларах.
![image](https://github.com/user-attachments/assets/beb43bf6-4f85-4385-a13c-668993baf163)
### Команда /modelparams позволяет настроить параметры модели (активацию веб-поиска, кеширование запросов, максимальное количество токенов для одного сообщения, topP, topK и температуру)



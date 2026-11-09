# Правки к переводу Tilmoch (uz_raw.json) — грубые ошибки и единая терминология
import json, re, os
D = os.path.dirname(__file__)
M = json.load(open(os.path.join(D, 'uz_raw.json'), encoding='utf-8'))
FIX = {
 'Закрыть': 'Yopish',
 'Обсудить проект': 'Loyihani muhokama qilish',
 'Кейсы внедрения Asterisk': 'Asterisk’ni joriy etish keyslari',
 'Кейсы внедрения amoCRM': 'amoCRM’ni joriy etish keyslari',
 'Кейсы внедрения Битрикс24': 'Bitrix24’ni joriy etish keyslari',
 'Кейсы внедрения Flatris': 'Flatris’ni joriy etish keyslari',
 'Кейсы внедрения МойСклад': 'MoySkladni joriy etish keyslari',
 'Call-центры и IP-телефония на Asterisk, которые мы запустили для клиентов в Узбекистане.': 'O‘zbekistondagi mijozlarimiz uchun Asterisk’da ishga tushirgan call-markazlar va IP-telefoniya.',
 'Внедрение Битрикс24, автоматизация процессов, аналитика и интеграции для наших клиентов в Узбекистане.': 'O‘zbekistondagi mijozlarimiz uchun Bitrix24’ni joriy etish, jarayonlarni avtomatlashtirish, tahlil va integratsiyalar.',
 'звонков в день': 'qo‘ng‘iroq kuniga', 'звонков в месяц': 'qo‘ng‘iroq oyiga',
 'Что сделали': 'Nima qildik', 'С чем пришли': 'Muammo',
 'звонков с запуска': 'qo‘ng‘iroq ishga tushgandan beri', 'среднее ожидание в очереди': 'navbatda o‘rtacha kutish',
 'интеграция через Itgrix': 'Itgrix orqali integratsiya', '4 уровня': '4 daraja',
 'звонков в сутки с записью в amoCRM': 'qo‘ng‘iroq sutkasiga, amoCRM’da yozuv bilan', 'сотрудников в одной АТС': 'xodim bitta ATSda',
 'Было и стало': 'Avval va hozir', 'Было': 'Avval', 'Стало': 'Hozir',
 'Разговоры менеджеров на мобильных не попадали в amoCRM': 'Menejerlarning mobil telefondagi suhbatlari amoCRM’ga tushmasdi',
 'Если менеджер занят, клиент терялся': 'Agar menejer band bo‘lsa, mijoz yo‘qolib qolardi',
 'Звонок идёт дальше: другие менеджеры, операторы, дежурный номер': 'Qo‘ng‘iroq keyingisiga o‘tadi: boshqa menejerlar, operatorlar, navbatchi raqam',
 'Записи не открывались в мобильном amoCRM': 'Yozuvlar mobil amoCRM’da ochilmasdi',
 'Сложные пароли и автоматическая блокировка подбора': 'Murakkab parollar va parol tanlashni avtomatik bloklash',
 'Как обрабатывается звонок': 'Qo‘ng‘iroq qanday qayta ishlanadi',
 '1 общий номер для офиса и выездных менеджеров.': 'Ofis va sayyor menejerlar uchun 1 ta umumiy raqam.',
 'конверсия обращения в продажу': 'murojaatdan sotuvga konversiya',
 'Конверсия из обращения в продажу выросла на 18%.': 'Murojaatdan sotuvga konversiya 18% ga oshdi.',
 'Выстроили единую CRM для отдела продаж: воронки, автоматическое распределение заявок, контроль задач и аналитика. После запуска взяли систему на сопровождение.': 'Savdo bo‘limi uchun yagona CRM yaratdik: voronkalar, arizalarni avtomatik taqsimlash, vazifalar nazorati va tahlil. Ishga tushirgandan so‘ng tizimni qo‘llab-quvvatlashga oldik.',
 'конверсия заявки в сделку': 'arizadan bitimga konversiya',
 'Битрикс24 (коробка) с Instagram, Facebook и ИИ-ботом': 'Bitrix24 korobka versiyasi Instagram, Facebook va SI-bot bilan',
 'Внедрили коробочный Битрикс24, собрали обращения из соцсетей в CRM и запустили ИИ-ассистента, который сам отвечает на вопросы в Instagram.': 'Bitrix24 korobka versiyasini joriy etdik, ijtimoiy tarmoqlardagi murojaatlarni CRM’ga yig‘dik va Instagram’dagi savollarga o‘zi javob beradigan SI-yordamchini ishga tushirdik.',
 'Внедрили и настроили коробочную версию Битрикс24: CRM, воронки, стадии сделок, карточки клиентов.': 'Bitrix24 korobka versiyasini joriy etdik va sozladik: CRM, voronkalar, bitim bosqichlari, mijoz kartochkalari.',
 'быстрее первый ответ клиенту': 'mijozga birinchi javob tezroq', 'обработанных обращений': 'ko‘proq murojaat ko‘rib chiqiladi',
 'Медицина': 'Tibbiyot',
 'Интерактивная шахматка Flatris с бронированием из amoCRM': 'amoCRM’dan bron qilish imkoniga ega Flatris interaktiv shaxmatkasi',
 'запросов в обработке': 'ko‘proq so‘rov qayta ishlanadi',
 'ЖК Sunrise': 'Sunrise TJM',
 'Добавили в карточки отдельный тип для учёта брака.': 'Yaroqsiz mahsulot (brak) hisobi uchun kartochkalarga alohida tur qo‘shdik.',
 'Max Decor производит и наносит декоративные стеновые материалы с 2003 года.': 'Max Decor 2003-yildan beri dekorativ devor materiallarini ishlab chiqaradi va devorlarga qoplaydi.',
 'складов': 'ta ombor', 'розничные точки': 'ta chakana savdo nuqtasi', 'доступ сотрудников': 'xodimlar uchun kirish huquqi',
 'складов: сырьё, цех, готовая продукция': 'ombor turi: xomashyo, sex, tayyor mahsulot',
 'Настроили интерактивную шахматку объектов во Flatris и отображение статусов.': 'Flatris’da obyektlarning interaktiv shaxmatkasini va statuslar ko‘rinishini sozladik.',
 'Интегрировали Flatris с amoCRM: переход из карточки CRM прямо в шахматку.': 'Flatris’ni amoCRM bilan integratsiya qildik: CRM kartochkasidan to‘g‘ridan-to‘g‘ri shaxmatkaga o‘tish.',
 'Шахматка квартир во Flatris со статусами': 'Flatris’dagi statusli kvartiralar shaxmatkasi',
 'Интерактивный выбор дома во Flatris': 'Flatris’da uyni interaktiv tanlash',
 '6 статусов': '6 ta status', '3 уровня': '3 daraja', 'ОКК': 'SNB',
 'задачи и уведомления по заявкам': 'arizalar bo‘yicha vazifalar va bildirishnomalar',
 'Производственный учёт в МойСклад с техкартами': 'MoySkladda texnologik kartalar bilan ishlab chiqarish hisobi',
}
M.update(FIX)
def post(s):
    s = s.replace('shaxmat o‘yini', 'shaxmatka').replace('shaxmat o‘yiniga', 'shaxmatkaga')
    s = re.sub(r'shaxmat(?!ka)', 'shaxmatka', s)
    for a, b in [('texnik xarita', 'texnologik karta'), ('texnologik xarita', 'texnologik karta'), ('texnik karta', 'texnologik karta'),
                 ('AmoCRM', 'amoCRM'), ('TXK', 'PTO'), ('maqomlar', 'statuslar'), ('1S ', '1C '), ('1S ', '1C '), ('Bitrix24 ni', 'Bitrix24’ni'), ('quti shaklidagi', 'korobka'), ('quti versiya', 'korobka versiya')]:
        s = s.replace(a, b)
    s = re.sub(r'\b1S\b', '1C', s)
    s = re.sub(r'"([^"]+)"', r'«\1»', s)
    s = s.replace('shaxmatkaini', 'shaxmatkasini').replace('shaxmatkai ', 'shaxmatkasi ')
    s = s.replace(' - ', ' — ')
    return s
UZ = {k: post(v) for k, v in M.items()}

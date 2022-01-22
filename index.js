'use strict';
const BootBot = require('bootbot');
const config = require('config');
const NewsAPI = require('newsapi');
const newsapi = new NewsAPI('8380a0a1c6454e26b92963ae473cb230');
const request = require('request');
const cheerio = require('cheerio');
const travel_countries = [];
const recent_cases = [];

// Web scraping the site to fetch country names and cases data
function getData() {
  const url = `https://www.ecdc.europa.eu/en/geographical-distribution-2019-ncov-cases`;
  request(url, (error, response, html) => {
    if(!error && response.statusCode === 200){
        const $ = cheerio.load(html);
        $('tbody > tr > td:nth-child(2)').toArray().map(item =>{
          travel_countries.push($(item).text().toLowerCase().split('_').join(''));
        });
        $('tbody > tr > td:nth-child(5)').toArray().map(item =>{
          recent_cases.push(parseInt($(item).text()));
        });
      }
  });
}

// Helper to retreive the number of case for the country
function getCases(name){
  var temp = name.toLowerCase().split(' ').join('');
  for(let i = 0; i < travel_countries.length; i++){
    if (travel_countries[i] == temp){
      return recent_cases[i];
    }
  }
}

//Bot initialization
const bot = new BootBot({
  accessToken: config.get('accessToken'),
  verifyToken: config.get('verifyToken'),
  appSecret: config.get('appSecret')
});

// Gets the news articles
const getNewsPre = (convo) =>{
  convo.ask({
    text: 'Which country would you like to check (ISO code (ex: gb, jp, us, kr))?',
    quickReplies: ['gb', 'us', 'kr', 'jp']
  }, (payload, convo) => {
        const country = payload.message.text;
        convo.set('country', country);
        convo.set('index', 0);
        convo.say(`Fetching top covid news from ${country}`).then(() => getNews(convo));
      });
};

// Helper that fetch the news headline
const getNews = (convo) => {
  newsapi.v2.topHeadlines({
    q: 'covid',
    language: 'en',
    country: `${convo.get('country')}`
  }).then(response => {
    if(response['totalResults'] == 0){
      convo.say('No articles are found! Try another country.').then(() => getNewsPre(convo));
    }
    var title = response['articles'][convo.get('index')]['title'];
    var article_link = response['articles'][convo.get('index')]['url'];
    convo.say(`Top news: ${title} \n Link: ${article_link}`);
    convo.ask(`More articles? (y / anything else to stop)`, (payload, convo, data) => {
      if(payload.message.text.toLowerCase() == 'y'){
        var temp = convo.get('index');
        temp += 1;
        convo.set('index', temp);
        convo.say('On it!').then(() => getNews(convo));
      }else{
        convo.say('Got it!');
        convo.end();
      }
    });
  });
}
// Helper that determines the safety of your journey
const checkJourney = (convo) =>{
    var total_cases = 0;
    var countries_check = convo.get('countries')
    for(let i = 0; i < countries_check.length; i++){
      total_cases += getCases(countries_check[i].trim());
    }
    console.log(total_cases);
    if(total_cases > 300000){
      convo.say("Danger Level: Red");
      convo.say("Places you are traveling to are the places where the number of reported covid cases for the past 14 days is DANGEROUSLY HIGH.");
      convo.say("FlySafe bot recommends you not to travel these places, but if you must FlySafe bot recommends you to be fully vaccinated before you go. Also don't forget the masks");
    }else if(200000 >= total_cases && total_cases > 100000){
      convo.say("Danger Level: Yellow");
      convo.say("Places you are traveling to are the places where the number of reported covid cases for the past 14 days is MODERATE.");
      convo.say("FlySafe bot recommends you to be fully vaccinated before you go and wear your masks during the flight");
    }else{
      convo.say("Danger Level: Green");
      convo.say("Places you are traveling to are the places where the number of reported covid cases for the past 14 days is LOW.");
      convo.say("FlySafe bot recommends you to wear your masks during the flight and wash your hands frequently");
    }
    convo.end();
}

// Current journey helper
const checkJourneyPre = (convo) => {
  convo.ask("Which countries are you travelling? (Seperate each country with a comma (,), write full names (ex United States of America, United Kingdom))", (payload ,convo)=>{
    const countries = payload.message.text.split(",");
    convo.set('countries', countries);
    convo.say("received the list of countries! calculating... ").then(() => checkJourney(convo));
  });
}

// Future Journey helper
const checkJourneyPost = (convo) => {
  convo.ask("Which countries are you wishing to travel? (Seperate each country with a comma (,), write full names (ex United States of America, United Kingdom))", (payload ,convo)=>{
    const countries = payload.message.text.split(",");
    convo.set('countries', countries);
    convo.say("received the list of countries! calculating... ").then(() => checkJourney(convo));
  });
}


// Bot main codes
bot.setGreetingText("Welcome to FlySafeBot. We are here to make your journey safer! How can we help you today?");
bot.setGetStartedButton((payload, chat) => {
  chat.say('Welcome to FlySafeBot. We are here to make your journey safer!');
  chat.say('type "Help" to see what I can offer.');
  chat.say('or you can press the menu button on the right of your emoji button to navigate.');
});

bot.setPersistentMenu([
  {
    type: 'postback',
    title: 'Check my current flight',
    payload: 'PERSISTENT_MENU_JOURNEYSAFE'
  },
  {
    type: 'postback',
    title: 'Check my future journey',
    payload: 'PERSISTENT_MENU_FUTUREJOURNEY'
  },
  {
    type: 'postback',
    title: 'Check recent covid news',
    payload: 'PERSISTENT_MENU_RECENTNEWS'
  },
]);

bot.hear(['help'], (payload, chat)=>{
  chat.say({
		text: 'What do you need help with?',
		buttons: [
			{
        type: 'postback',
        title: 'Check my current flight',
        payload: 'PERSISTENT_MENU_JOURNEYSAFE'
      },
      {
        type: 'postback',
        title: 'Check my future journey',
        payload: 'PERSISTENT_MENU_FUTUREJOURNEY'
      },
      {
        type: 'postback',
        title: 'Check recent covid news',
        payload: 'PERSISTENT_MENU_RECENTNEWS'
      }]
	});
});

bot.on('postback:PERSISTENT_MENU_RECENTNEWS', (payload, chat) =>{
  chat.conversation((convo) => {
    convo.say('right on it!').then(() => getNewsPre(convo));
  });
});

bot.on('postback:PERSISTENT_MENU_JOURNEYSAFE', (payload, chat)=>{
  chat.conversation((convo) => {
    getData();
    convo.say('right on it!').then(() => checkJourneyPre(convo));
  });
})
bot.on('postback:PERSISTENT_MENU_FUTUREJOURNEY', (payload, chat) => {
  chat.conversation((convo) => {
    getData();
    convo.say('right on it!').then(() => checkJourneyPost(convo));
  });
});

bot.start(config.get('botPort'));

import { storage } from "./storage.js";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Home, Plus, Trash2, Check, X, Clock, Layers, Repeat, RotateCcw, BookOpen, Download, Upload, Search, AlertCircle, Target, Lightbulb, Users } from 'lucide-react';

const COLORS = {
  paper: '#F6F1E7',
  card: '#FFFDF7',
  ink: '#2C2823',
  inkLight: '#9A8F7E',
  rule: '#E2D7C3',
  red: '#B5483D',
  redSoft: '#F2DCD7',
  green: '#5E7A56',
  greenSoft: '#E1E9DB',
  gold: '#C79A33',
  blue: '#6E8FA3',
  blueSoft: '#E1E8EC',
};

const TYPE_META = {
  noun: { label: 'Noun', color: COLORS.gold },
  verb: { label: 'Verb', color: COLORS.green },
  adjective: { label: 'Adjective', color: COLORS.blue },
  other: { label: 'Other', color: COLORS.inkLight },
};
const TYPE_OPTIONS = ['noun', 'verb', 'adjective', 'other'];

function normalizeType(raw) {
  const t = String(raw || '').trim().toLowerCase();
  if (['noun', 'nomen', 'n'].includes(t)) return 'noun';
  if (['verb', 'v'].includes(t)) return 'verb';
  if (['adjective', 'adj', 'adjektiv'].includes(t)) return 'adjective';
  return 'other';
}

const BOX_WEIGHTS = { 1: 10, 2: 6, 3: 3, 4: 1.5, 5: 0.6 };
const STORAGE_WORDS = 'karteikasten-words';
const STORAGE_HISTORY = 'karteikasten-history';
const STORAGE_SEEDED = 'karteikasten-seeded';
const STORAGE_SETTINGS = 'karteikasten-settings';
const STORAGE_EXAMPLES_BACKFILLED = 'karteikasten-examples-backfilled-1';
const STORAGE_B1_IMPORT_DONE = 'karteikasten-b1-import-1';
const STORAGE_BATCH3_DONE = 'karteikasten-batch3-import-1';
const STORAGE_PROFILES = 'karteikasten-profiles';
const STORAGE_ACTIVE_PROFILE = 'karteikasten-active-profile';
const progressKey = (uid) => `karteikasten-progress-${uid}`;
const historyKey = (uid) => `karteikasten-history-${uid}`;

// Progress fields that are per-user (kept in separate progress store)
const PROGRESS_FIELDS = ['box','seen','correct','incorrect','articleBox','articleSeen','articleCorrect','articleIncorrect','lastFailWasArticleOnly','lastSeen'];

function extractProgress(word) {
  const p = {};
  for (const f of PROGRESS_FIELDS) if (f in word) p[f] = word[f];
  return p;
}

function applyProgress(word, progress) {
  if (!progress) return word;
  return { ...word, ...progress };
}

// Default progress for a word a user hasn't touched yet
function defaultProgress() {
  return { box: 1, seen: 0, correct: 0, incorrect: 0, articleBox: 1, articleSeen: 0, articleCorrect: 0, articleIncorrect: 0, lastFailWasArticleOnly: false };
}

const BATCH3_WORDS = [
  ['das Schnippchen','the trick (jdm. ein Schnippchen schlagen = to outwit sb.)','noun',['Er hat dem Gegner ein Schnippchen geschlagen.','He outwitted his opponent.']],
  ['kaum etwas','hardly anything','other',['Es gab kaum etwas zu essen.','There was hardly anything to eat.']],
  ['das stimmt / das stimmt nicht','that\'s right / that\'s not right','other',['Das stimmt, ich war gestern dort.','That\'s right, I was there yesterday.']],
  ['eindeutig','clear / unambiguous / definitely','adjective',['Das ist eindeutig seine Schuld.','That is clearly his fault.']],
  ['sogar','even / in fact','other',['Er spricht sogar drei Sprachen.','He even speaks three languages.']],
  ['nachschauen','to check / to look up','verb',['Ich schaue schnell im Wörterbuch nach.','I\'ll quickly look it up in the dictionary.']],
  ['die Freiräume','the free spaces / room to breathe','noun',['Kinder brauchen Freiräume zum Spielen.','Children need free spaces to play.']],
  ['mitnehmen','to take along / to take with','verb',['Kann ich dich im Auto mitnehmen?','Can I give you a lift in the car?']],
  ['staunen','to be amazed / to marvel','verb',['Ich staune immer wieder über seine Geduld.','I am always amazed by his patience.']],
  ['recht','quite / rather','other',['Das war recht schwierig für mich.','That was quite difficult for me.']],
  ['die Mitteilung','the notification / announcement','noun',['Ich habe eine wichtige Mitteilung bekommen.','I received an important notification.']],
  ['entdecken','to discover','verb',['Sie hat ein neues Restaurant entdeckt.','She discovered a new restaurant.']],
  ['außerhalb','outside (of) / beyond','other',['Er wohnt außerhalb der Stadt.','He lives outside the city.']],
  ['verbergen','to hide / to conceal','verb',['Sie konnte ihre Traurigkeit nicht verbergen.','She couldn\'t hide her sadness.']],
  ['vergeben','to forgive / to award','verb',['Es ist wichtig, vergeben zu können.','It is important to be able to forgive.']],
];

const STORAGE_VERB_PREP_DONE = 'karteikasten-verb-prep-1';

// B1 verbs with prepositions — each preposition is a separate card.
// Format: [german, english, type, [exampleDe, exampleEn], level]
// Verbs already in the app (berichten, denken, fragen, hören, kämpfen,
// schließen, schreiben, sorgen, sprechen, suchen, teilnehmen, warten) are skipped.
const VERB_PREP_WORDS = [
  ['abhängen von','to depend on','verb',['Das Ergebnis hängt von deiner Arbeit ab.','The result depends on your work.'],'B1'],
  ['achten auf','to pay attention to','verb',['Du musst auf deine Gesundheit achten.','You must pay attention to your health.'],'B1'],
  ['anfangen mit','to start with / start doing','verb',['Wann fängst du mit dem Lernen an?','When will you start studying?'],'B1'],
  ['aufhören mit','to stop doing','verb',['Er hat mit dem Rauchen aufgehört.','He stopped smoking.'],'B1'],
  ['beitragen zu','to contribute to','verb',['Jeder kann zur Lösung beitragen.','Everyone can contribute to the solution.'],'B1'],
  ['bereit sein zu','to be ready / willing to','verb',['Ich bin bereit zu helfen.','I am willing to help.'],'B1'],
  ['bestehen aus','to consist of','verb',['Das Team besteht aus zehn Personen.','The team consists of ten people.'],'B1'],
  ['bestehen auf','to insist on','verb',['Sie besteht auf einer Entschuldigung.','She insists on an apology.'],'B1'],
  ['bestehen in','to lie in / consist in','verb',['Das Problem besteht in der fehlenden Kommunikation.','The problem lies in the lack of communication.'],'B1'],
  ['bitten um','to ask for / request','verb',['Er bat uns um Hilfe.','He asked us for help.'],'B1'],
  ['einverstanden sein mit','to agree with','verb',['Ich bin mit dem Plan einverstanden.','I agree with the plan.'],'B1'],
  ['erkennen an','to recognize by','verb',['Man erkennt ihn an seiner Stimme.','You can recognize him by his voice.'],'B1'],
  ['gehören zu','to belong to / be part of','verb',['Geduld gehört zu den wichtigsten Eigenschaften.','Patience belongs to the most important qualities.'],'B1'],
  ['glauben an','to believe in','verb',['Ich glaube an seine Fähigkeiten.','I believe in his abilities.'],'B1'],
  ['hinweisen auf','to point out','verb',['Der Lehrer wies auf den Fehler hin.','The teacher pointed out the mistake.'],'B1'],
  ['hoffen auf','to hope for','verb',['Wir hoffen auf besseres Wetter.','We are hoping for better weather.'],'B1'],
  ['hören von','to hear about','verb',['Ich habe von deinem Erfolg gehört.','I heard about your success.'],'B1'],
  ['kommen auf','to come up with (an idea)','verb',['Wie bist du auf diese Idee gekommen?','How did you come up with this idea?'],'B1'],
  ['lachen über','to laugh about','verb',['Wir haben über seinen Witz gelacht.','We laughed about his joke.'],'B1'],
  ['nachdenken über','to think about / reflect on','verb',['Ich denke oft über die Zukunft nach.','I often think about the future.'],'B1'],
  ['neigen zu','to tend to','verb',['Er neigt dazu, zu übertreiben.','He tends to exaggerate.'],'B1'],
  ['profitieren von','to benefit from','verb',['Wir profitieren von der neuen Regelung.','We benefit from the new regulation.'],'B1'],
  ['protestieren gegen','to protest against','verb',['Die Bürger protestieren gegen das Gesetz.','The citizens are protesting against the law.'],'B1'],
  ['reagieren auf','to react to','verb',['Wie hast du auf die Nachricht reagiert?','How did you react to the news?'],'B1'],
  ['rechnen mit','to count on / expect','verb',['Wir rechnen mit Verzögerungen.','We are counting on delays.'],'B1'],
  ['riechen nach','to smell of','verb',['Es riecht nach frisch gebackenem Brot.','It smells of freshly baked bread.'],'B1'],
  ['sich aufregen über','to get upset about','verb',['Er regt sich über Kleinigkeiten auf.','He gets upset about small things.'],'B1'],
  ['sich bedanken für','to thank for','verb',['Ich möchte mich für Ihre Hilfe bedanken.','I would like to thank you for your help.'],'B1'],
  ['sich begeistern für','to be enthusiastic about','verb',['Sie begeistert sich für Kunst.','She is enthusiastic about art.'],'B1'],
  ['sich beklagen über','to complain about','verb',['Er beklagt sich über den Lärm.','He complains about the noise.'],'B1'],
  ['sich bemühen um','to strive / make an effort for','verb',['Sie bemüht sich um eine Lösung.','She is making an effort to find a solution.'],'B1'],
  ['sich beschweren über','to complain about','verb',['Die Kunden haben sich über den Service beschwert.','The customers complained about the service.'],'B1'],
  ['sich beschäftigen mit','to deal with / be busy with','verb',['Er beschäftigt sich mit einem neuen Projekt.','He is busy with a new project.'],'B1'],
  ['sich beteiligen an','to participate in','verb',['Alle sollen sich an der Diskussion beteiligen.','Everyone should participate in the discussion.'],'B1'],
  ['sich bewerben um','to apply for (a position)','verb',['Sie bewirbt sich um die Stelle als Lehrerin.','She is applying for the position as a teacher.'],'B1'],
  ['sich bewerben bei','to apply at (a company)','verb',['Er bewirbt sich bei einer großen Firma.','He is applying at a large company.'],'B1'],
  ['sich bewerben als','to apply as (a role)','verb',['Ich bewerbe mich als Ingenieur.','I am applying as an engineer.'],'B1'],
  ['sich beziehen auf','to refer to','verb',['Ich beziehe mich auf Ihren Brief vom letzten Monat.','I am referring to your letter from last month.'],'B1'],
  ['sich einsetzen für','to advocate for','verb',['Sie setzt sich für Gleichberechtigung ein.','She advocates for equal rights.'],'B1'],
  ['sich entscheiden für','to decide for / choose','verb',['Ich habe mich für das rote Kleid entschieden.','I decided on the red dress.'],'B1'],
  ['sich entscheiden gegen','to decide against','verb',['Er hat sich gegen den Umzug entschieden.','He decided against the move.'],'B1'],
  ['sich entschließen zu','to decide / resolve to','verb',['Sie hat sich entschlossen, ins Ausland zu gehen.','She resolved to go abroad.'],'B1'],
  ['sich entschuldigen für','to apologize for','verb',['Er entschuldigte sich für sein Verhalten.','He apologized for his behaviour.'],'B1'],
  ['sich erinnern an','to remember','verb',['Ich erinnere mich gern an unsere Reise.','I like to remember our trip.'],'B1'],
  ['sich erkundigen nach','to inquire about','verb',['Er erkundigte sich nach den Öffnungszeiten.','He inquired about the opening hours.'],'B1'],
  ['sich freuen auf','to look forward to','verb',['Ich freue mich auf den Urlaub.','I am looking forward to the holiday.'],'B1'],
  ['sich freuen über','to be happy about','verb',['Sie freut sich über das Geschenk.','She is happy about the gift.'],'B1'],
  ['sich gewöhnen an','to get used to','verb',['Ich habe mich an den Lärm gewöhnt.','I have got used to the noise.'],'B1'],
  ['sich handeln um','to be about (es handelt sich um)','verb',['Es handelt sich um ein wichtiges Thema.','It is about an important topic.'],'B1'],
  ['sich interessieren für','to be interested in','verb',['Er interessiert sich sehr für Geschichte.','He is very interested in history.'],'B1'],
  ['sich irren in','to be wrong about','verb',['Du irrst dich in diesem Punkt.','You are wrong about this point.'],'B1'],
  ['sich konzentrieren auf','to concentrate on','verb',['Ich muss mich auf die Prüfung konzentrieren.','I have to concentrate on the exam.'],'B1'],
  ['sich kümmern um','to take care of','verb',['Sie kümmert sich um ihre alte Mutter.','She takes care of her elderly mother.'],'B1'],
  ['sich sehnen nach','to long for','verb',['Er sehnt sich nach seiner Heimat.','He longs for his homeland.'],'B1'],
  ['sich selbstständig machen als','to become self-employed as','verb',['Sie macht sich als Ärztin selbstständig.','She is becoming self-employed as a doctor.'],'B1'],
  ['sich unterhalten mit','to talk with','verb',['Ich habe mich lange mit ihm unterhalten.','I talked with him for a long time.'],'B1'],
  ['sich unterhalten über','to talk about','verb',['Wir haben uns über das Wetter unterhalten.','We talked about the weather.'],'B1'],
  ['sich unterscheiden von','to differ from','verb',['Sein Stil unterscheidet sich sehr von meinem.','His style differs greatly from mine.'],'B1'],
  ['sich unterscheiden in','to differ in','verb',['Die Produkte unterscheiden sich nur im Preis.','The products differ only in price.'],'B1'],
  ['sich verlassen auf','to rely on','verb',['Auf ihn kann ich mich immer verlassen.','I can always rely on him.'],'B1'],
  ['sich verlieben in','to fall in love with','verb',['Er hat sich in seine Kollegin verliebt.','He fell in love with his colleague.'],'B1'],
  ['sich vorbereiten auf','to prepare for','verb',['Ich bereite mich auf das Interview vor.','I am preparing for the interview.'],'B1'],
  ['sich wundern über','to be surprised about','verb',['Ich wundere mich über seine Reaktion.','I am surprised about his reaction.'],'B1'],
  ['sich ärgern über','to be annoyed about','verb',['Sie ärgert sich über die Verspätung.','She is annoyed about the delay.'],'B1'],
  ['träumen von','to dream of','verb',['Er träumt von einer Weltreise.','He dreams of a trip around the world.'],'B1'],
  ['umgehen mit','to deal with / handle','verb',['Sie weiß, wie man mit Stress umgeht.','She knows how to deal with stress.'],'B1'],
  ['zufrieden sein mit','to be satisfied with','verb',['Ich bin sehr zufrieden mit dem Ergebnis.','I am very satisfied with the result.'],'B1'],
  ['zweifeln an','to doubt','verb',['Er zweifelt an seiner Entscheidung.','He doubts his decision.'],'B1'],
  ['überzeugt sein von','to be convinced of','verb',['Ich bin überzeugt von seiner Ehrlichkeit.','I am convinced of his honesty.'],'B1'],
];
// Format: [german, english, type, [exampleDe, exampleEn], level]
const B1_WORDS = [
  ['sich kleiden','to get dressed / to dress oneself','verb',['Sie kleidet sich immer sehr elegant.','She always dresses very elegantly.'],'B1'],
  ['die Umleitung','the detour / diversion','noun',['Wegen der Baustelle gibt es eine Umleitung.','There is a detour because of the construction site.'],'B1'],
  ['ausgeben','to spend (money) / to issue','verb',['Er gibt zu viel Geld für Kleidung aus.','He spends too much money on clothes.'],'B1'],
  ['einsam','lonely','adjective',['Sie fühlt sich in der großen Stadt sehr einsam.','She feels very lonely in the big city.'],'B1'],
  ['das Moped','the moped','noun',['Er fährt jeden Tag mit dem Moped zur Arbeit.','He rides his moped to work every day.'],'B1'],
  ['der Schaden','the damage','noun',['Der Sturm hat großen Schaden verursacht.','The storm caused great damage.'],'B1'],
  ['die Berufspläne','career plans','noun',['Hast du schon konkrete Berufspläne nach dem Studium?','Do you already have concrete career plans after university?'],'B1'],
  ['besorgt','worried / concerned','adjective',['Die Eltern sind sehr besorgt um ihr Kind.','The parents are very worried about their child.'],'B1'],
  ['berufstätig','employed / working','adjective',['Beide Elternteile sind berufstätig.','Both parents are working.'],'B1'],
  ['sich befinden','to be located / to find oneself','verb',['Das Museum befindet sich im Stadtzentrum.','The museum is located in the city centre.'],'B1'],
  ['selbstständig','self-employed / independent','adjective',['Sie ist seit drei Jahren selbstständig.','She has been self-employed for three years.'],'B1'],
  ['reiten','to ride (a horse)','verb',['Als Kind wollte sie immer reiten lernen.','As a child she always wanted to learn to ride.'],'B1'],
  ['ungefähr','approximately / about','other',['Das dauert ungefähr zwei Stunden.','That takes approximately two hours.'],'B1'],
  ['erfahren','to experience / to learn (news)','verb',['Ich habe erst gestern davon erfahren.','I only found out about it yesterday.'],'B1'],
  ['versorgen','to provide / to supply / to take care of','verb',['Sie versorgt die ganze Familie mit Essen.','She provides food for the whole family.'],'B1'],
  ['der Aufenthalt','the stay (e.g. hotel stay)','noun',['Wie lange war dein Aufenthalt in Wien?','How long was your stay in Vienna?'],'B1'],
  ['gestrichen','cancelled / painted','adjective',['Der Flug wurde leider gestrichen.','The flight was unfortunately cancelled.'],'B1'],
  ['ausdenken','to think up / to invent','verb',['Das hat er sich alles selbst ausgedacht.','He thought all of that up himself.'],'B1'],
  ['froh','glad / happy','adjective',['Ich bin froh, dass du gekommen bist.','I am glad that you came.'],'B1'],
  ['das Preisausschreiben','the competition / prize contest','noun',['Sie hat an einem Preisausschreiben teilgenommen.','She took part in a prize competition.'],'B1'],
  ['schlank','slim','adjective',['Er ist sehr sportlich und schlank.','He is very athletic and slim.'],'B1'],
  ['beigefügt','enclosed / attached','adjective',['Die Unterlagen sind beigefügt.','The documents are enclosed.'],'B1'],
  ['nützen','to be useful / to benefit','verb',['Das nützt mir leider gar nichts.','That is of no use to me at all, unfortunately.'],'B1'],
  ['übertreiben','to exaggerate','verb',['Du übertreibst mal wieder total!','You are totally exaggerating again!'],'B1'],
  ['unbedingt','absolutely / definitely / by all means','other',['Ich muss ihn unbedingt noch heute anrufen.','I absolutely must call him today.'],'B1'],
  ['treiben','to do / to drive / to push','verb',['Was treibst du in deiner Freizeit?','What do you do in your free time?'],'B1'],
  ['bereits','already','other',['Er hat das Buch bereits gelesen.','He has already read the book.'],'B1'],
  ['sich lohnen','to be worth it','verb',['Die Reise hat sich wirklich gelohnt.','The trip was really worth it.'],'B1'],
  ['das Versprechen','the promise','noun',['Ein Versprechen muss man halten.','One must keep a promise.'],'B1'],
  ['wahr','true','adjective',['Ist das wirklich wahr?','Is that really true?'],'B1'],
  ['halten','to hold / to keep / to stop','verb',['Der Bus hält an der nächsten Ecke.','The bus stops at the next corner.'],'B1'],
  ['irgendetwas','something / anything','other',['Hast du irgendetwas vergessen?','Did you forget something?'],'B1'],
  ['vorhanden','available / existing','adjective',['Leider ist kein Parkplatz vorhanden.','Unfortunately there is no parking available.'],'B1'],
  ['verbringen','to spend (time)','verb',['Wir verbringen den Sommer am Meer.','We are spending the summer by the sea.'],'B1'],
  ['üblich','usual / customary / common','adjective',['Das ist hier völlig üblich.','That is completely normal here.'],'B1'],
  ['stammen aus','to originate from','verb',['Dieses Rezept stammt aus der Türkei.','This recipe originates from Turkey.'],'B1'],
  ['innerhalb','within (time or space)','other',['Innerhalb einer Stunde war alles fertig.','Everything was done within an hour.'],'B1'],
  ['streng','strict','adjective',['Unser Lehrer war sehr streng.','Our teacher was very strict.'],'B1'],
  ['kommend','coming / upcoming','adjective',['Das Konzert findet nächste Woche statt.','The concert takes place next week.'],'B1'],
  ['unternehmen','to undertake / to do / to take action','verb',['Was wollen wir heute unternehmen?','What do we want to do today?'],'B1'],
  ['die Radwanderstrecke','the cycling trail / bike touring route','noun',['Die Radwanderstrecke führt durch den Wald.','The cycling trail leads through the forest.'],'B1'],
  ['die Gewinnverteilung','the distribution of profits / prizes','noun',['Die Gewinnverteilung war nicht fair.','The distribution of profits was not fair.'],'B1'],
  ['der Reichtum','the wealth','noun',['Reichtum allein macht nicht glücklich.','Wealth alone does not make you happy.'],'B1'],
  ['voraussetzen','to assume / to require','verb',['Diese Stelle setzt Berufserfahrung voraus.','This position requires professional experience.'],'B1'],
  ['die Clique','the friend group / clique','noun',['Er hängt viel mit seiner Clique ab.','He spends a lot of time with his friend group.'],'B1'],
  ['die Wanderreise','the hiking trip','noun',['Wir planen eine Wanderreise in den Alpen.','We are planning a hiking trip in the Alps.'],'B1'],
  ['die Spuren','the traces / tracks','noun',['Im Schnee sah man die Spuren eines Tieres.','In the snow you could see the tracks of an animal.'],'B1'],
  ['die Vorstellung','the idea / performance / imagination','noun',['Die Vorstellung des Theaterstücks war ausverkauft.','The performance of the play was sold out.'],'B1'],
  ['aufschreiben','to write down / to note','verb',['Schreib dir die Adresse auf, damit du sie nicht vergisst.','Write down the address so you don\'t forget it.'],'B1'],
  ['die Erholung','the recovery / relaxation','noun',['Der Urlaub war zur Erholung sehr gut.','The holiday was very good for relaxation.'],'B1'],
  ['der Empfang','the reception','noun',['Der Empfang im Hotel war sehr herzlich.','The reception at the hotel was very warm.'],'B1'],
  ['gerecht','fair / just','adjective',['Die Entscheidung war nicht gerecht.','The decision was not fair.'],'B1'],
  ['die Zeugnisse','the certificates / reports','noun',['Sie hat sehr gute Zeugnisse.','She has very good reports/certificates.'],'B1'],
  ['die Eisenbahn','the railway / railroad','noun',['Früher sind wir immer mit der Eisenbahn gereist.','In the past we always traveled by railway.'],'B1'],
  ['verwenden','to use','verb',['Wofür verwendest du dieses Programm?','What do you use this program for?'],'B1'],
  ['der Sprachaufenthalt','the language study trip','noun',['Sie machte einen Sprachaufenthalt in England.','She did a language study trip in England.'],'B1'],
  ['merkwürdig','strange / peculiar','adjective',['Sein Verhalten war sehr merkwürdig.','His behaviour was very strange.'],'B1'],
  ['das Unternehmen','the company / enterprise','noun',['Das Unternehmen hat 500 Mitarbeiter.','The company has 500 employees.'],'B1'],
  ['verunsichert','unsettled / insecure / confused','adjective',['Die Nachricht hat mich sehr verunsichert.','The news left me very unsettled.'],'B1'],
  ['ständig','constantly / continuously','other',['Er ist ständig am Handy.','He is constantly on his phone.'],'B1'],
  ['die Aufsicht','the supervision','noun',['Die Kinder brauchen immer Aufsicht.','Children always need supervision.'],'B1'],
  ['die Kriterien','the criteria','noun',['Welche Kriterien sind für die Bewerbung wichtig?','Which criteria are important for the application?'],'B1'],
  ['anwesend','present (in attendance)','adjective',['Alle Schüler waren heute anwesend.','All students were present today.'],'B1'],
  ['der Anbieter','the provider','noun',['Wir wechseln den Anbieter für das Internet.','We are changing our internet provider.'],'B1'],
  ['durchführen','to carry out / to conduct','verb',['Wir müssen die Untersuchung noch durchführen.','We still need to carry out the examination.'],'B1'],
  ['die Fachleute','the experts / specialists','noun',['Die Fachleute empfehlen diese Lösung.','The experts recommend this solution.'],'B1'],
  ['geheimnisvoll','mysterious','adjective',['Sie lächelte auf eine geheimnisvolle Art.','She smiled in a mysterious way.'],'B1'],
  ['winterlich','wintry','adjective',['Es herrschten winterliche Temperaturen.','There were wintry temperatures.'],'B1'],
  ['die Anerkennung','the recognition / appreciation','noun',['Er verdient mehr Anerkennung für seine Arbeit.','He deserves more recognition for his work.'],'B1'],
  ['der Fahrstil','the driving style','noun',['Sein aggressiver Fahrstil ist gefährlich.','His aggressive driving style is dangerous.'],'B1'],
  ['annehmen','to assume / to accept / to receive','verb',['Ich nehme an, dass er morgen kommt.','I assume that he is coming tomorrow.'],'B1'],
  ['reichen','to be enough / to suffice','verb',['Das Geld reicht nicht bis Ende des Monats.','The money won\'t last until the end of the month.'],'B1'],
  ['die Schlittschuhe','the ice skates','noun',['Im Winter laufe ich gern Schlittschuhe.','In winter I like to go ice skating.'],'B1'],
  ['sich begeben','to proceed / to go (reflexive)','verb',['Wir begaben uns sofort auf den Weg.','We set off immediately.'],'B1'],
  ['der Stiefel','the boot','noun',['Im Winter trage ich immer warme Stiefel.','In winter I always wear warm boots.'],'B1'],
  ['der Zugang','the access','noun',['Alle Mitarbeiter haben Zugang zu diesem Raum.','All employees have access to this room.'],'B1'],
  ['die Verfügung','the disposal / availability','noun',['Das Auto steht mir zur Verfügung.','The car is at my disposal.'],'B1'],
  ['die Geduld','the patience','noun',['Geduld ist eine wichtige Eigenschaft.','Patience is an important quality.'],'B1'],
  ['wecken','to awaken / to arouse','verb',['Der Lärm hat mich früh geweckt.','The noise woke me up early.'],'B1'],
  ['musisch','artistic / creative','adjective',['Sie ist sehr musisch begabt.','She is very artistically talented.'],'B1'],
  ['leiden','to suffer','verb',['Er leidet an einer seltenen Krankheit.','He suffers from a rare illness.'],'B1'],
  ['verstärken','to strengthen / to reinforce','verb',['Sport kann das Immunsystem verstärken.','Exercise can strengthen the immune system.'],'B1'],
  ['kichern','to giggle','verb',['Die Mädchen kicherten die ganze Zeit.','The girls giggled the whole time.'],'B1'],
  ['altersgemäß','age-appropriate','adjective',['Das Buch ist für Kinder nicht altersgemäß.','The book is not age-appropriate for children.'],'B1'],
  ['glucksen','to chuckle / to gurgle','verb',['Das Baby gluckste fröhlich.','The baby gurgled happily.'],'B1'],
  ['ganzheitlich','holistic','adjective',['Sie bevorzugt einen ganzheitlichen Ansatz.','She prefers a holistic approach.'],'B1'],
  ['seltener','more rarely / less often','other',['Ich esse seltener Fleisch als früher.','I eat meat more rarely than before.'],'B1'],
  ['angelegt','designed / intended / laid out','adjective',['Der Garten ist sehr schön angelegt.','The garden is very beautifully laid out.'],'B1'],
  ['bewiesen','proven','adjective',['Das ist wissenschaftlich bewiesen.','That is scientifically proven.'],'B1'],
  ['das Betätigungsfeld','the field of activity','noun',['Das ist ein interessantes Betätigungsfeld.','That is an interesting field of activity.'],'B1'],
  ['kaum','hardly / barely','other',['Ich kenne ihn kaum.','I hardly know him.'],'B1'],
  ['empfunden','perceived / felt','adjective',['Die Kälte wurde als angenehm empfunden.','The cold was perceived as pleasant.'],'B1'],
  ['die Belastung','the burden / stress / load','noun',['Der Job ist eine große Belastung für ihn.','The job is a great burden for him.'],'B1'],
  ['klagen','to complain','verb',['Er klagt immer über das schlechte Wetter.','He is always complaining about the bad weather.'],'B1'],
  ['die Untersuchung','the examination / investigation','noun',['Die Untersuchung ergab keine Probleme.','The examination revealed no problems.'],'B1'],
  ['beobachten','to observe','verb',['Die Wissenschaftler beobachten die Vögel genau.','The scientists observe the birds closely.'],'B1'],
  ['geschickt','skillful / adept','adjective',['Sie ist sehr geschickt mit ihren Händen.','She is very skillful with her hands.'],'B1'],
  ['unangenehm','unpleasant','adjective',['Das Gespräch war sehr unangenehm.','The conversation was very unpleasant.'],'B1'],
  ['verhandeln','to negotiate','verb',['Sie verhandeln seit Stunden über den Preis.','They have been negotiating about the price for hours.'],'B1'],
  ['überzeugen','to convince / to persuade','verb',['Er hat mich von seiner Idee überzeugt.','He convinced me of his idea.'],'B1'],
  ['die Gelegenheit','the opportunity','noun',['Diese Gelegenheit darf man nicht verpassen.','One must not miss this opportunity.'],'B1'],
  ['provozieren','to provoke','verb',['Er versucht immer, andere zu provozieren.','He always tries to provoke others.'],'B1'],
  ['die Verantwortung','the responsibility','noun',['Er trägt die Verantwortung für das Projekt.','He bears the responsibility for the project.'],'B1'],
  ['bewusst','conscious / deliberate','adjective',['Das war eine bewusste Entscheidung.','That was a deliberate decision.'],'B1'],
  ['die Stimmung','the mood / atmosphere','noun',['Die Stimmung auf der Party war super.','The atmosphere at the party was great.'],'B1'],
  ['erlernen','to learn / to acquire (a skill)','verb',['Sie hat Gitarre spielen erlernt.','She learned to play the guitar.'],'B1'],
  ['die Sorgen','the worries / concerns','noun',['Er macht sich viele Sorgen um die Zukunft.','He worries a lot about the future.'],'B1'],
  ['die Erwartung','the expectation','noun',['Die Ergebnisse übertrafen alle Erwartungen.','The results exceeded all expectations.'],'B1'],
  ['umschauen','to look around','verb',['Ich schaue mich erst mal um.','I\'ll have a look around first.'],'B1'],
  ['anpassen','to adapt / to adjust','verb',['Man muss sich schnell anpassen können.','One must be able to adapt quickly.'],'B1'],
  ['treten','to step / to kick','verb',['Bitte nicht auf den Rasen treten!','Please do not step on the grass!'],'B1'],
  ['identifizieren','to identify','verb',['Kannst du das Problem identifizieren?','Can you identify the problem?'],'B1'],
  ['faszinieren','to fascinate','verb',['Diese Thema fasziniert mich sehr.','This topic fascinates me greatly.'],'B1'],
  ['die Voraussetzung','the requirement / prerequisite','noun',['Gute Sprachkenntnisse sind eine wichtige Voraussetzung.','Good language skills are an important prerequisite.'],'B1'],
  ['kämpfen','to fight / to struggle','verb',['Er kämpft für seine Rechte.','He is fighting for his rights.'],'B1'],
  ['die Vertretung','the substitute / representation','noun',['Sie übernimmt die Vertretung, wenn er krank ist.','She takes over as substitute when he is sick.'],'B1'],
  ['berichten über','to report on / to give an account of','verb',['Die Zeitung berichtet über den Unfall.','The newspaper reports on the accident.'],'B1'],
  ['unabhängig','independent','adjective',['Sie möchte finanziell unabhängig sein.','She wants to be financially independent.'],'B1'],
  ['die Vorurteile','the prejudices / biases','noun',['Vorurteile sind gefährlich und unfair.','Prejudices are dangerous and unfair.'],'B1'],
  ['gesellschaftlich','social / societal','adjective',['Das ist ein wichtiges gesellschaftliches Thema.','That is an important societal topic.'],'B1'],
  ['zusammenhängen','to be connected / to be related','verb',['Diese beiden Probleme hängen zusammen.','These two problems are connected.'],'B1'],
  ['allerdings','however / though / admittedly','other',['Das Essen war gut, allerdings etwas teuer.','The food was good, though a bit expensive.'],'B1'],
  ['vergüten','to compensate / to pay','verb',['Überstunden werden bei uns vergütet.','Overtime is compensated at our company.'],'B1'],
];

// Starter A1-B1 vocabulary, loaded automatically on first use only.
const SEED_WORDS = [
  ['der Mann','the man','noun',['Der Mann trinkt einen Kaffee.','The man is drinking a coffee.']],
  ['die Frau','the woman','noun',['Die Frau arbeitet in der Stadt.','The woman works in the city.']],
  ['das Kind','the child','noun',['Das Kind spielt im Garten.','The child is playing in the garden.']],
  ['der Tag','the day','noun',['Heute ist ein schöner Tag.','Today is a beautiful day.']],
  ['die Nacht','the night','noun',['Die Nacht war sehr kalt.','The night was very cold.']],
  ['das Jahr','the year','noun',['Dieses Jahr reisen wir nach Berlin.','This year we are traveling to Berlin.']],
  ['die Zeit','the time','noun',['Ich habe keine Zeit mehr.','I don\u2019t have any more time.']],
  ['das Haus','the house','noun',['Das Haus ist sehr groß.','The house is very big.']],
  ['die Wohnung','the apartment','noun',['Die Wohnung liegt im Zentrum.','The apartment is located downtown.']],
  ['der Tisch','the table','noun',['Das Buch liegt auf dem Tisch.','The book is lying on the table.']],
  ['der Stuhl','the chair','noun',['Der Stuhl steht neben dem Fenster.','The chair stands next to the window.']],
  ['das Fenster','the window','noun',['Bitte mach das Fenster zu.','Please close the window.']],
  ['die Tür','the door','noun',['Die Tür ist nicht abgeschlossen.','The door isn\u2019t locked.']],
  ['das Auto','the car','noun',['Mein Auto steht vor dem Haus.','My car is parked in front of the house.']],
  ['der Bus','the bus','noun',['Der Bus kommt in fünf Minuten.','The bus arrives in five minutes.']],
  ['der Zug','the train','noun',['Der Zug fährt um acht Uhr ab.','The train departs at eight o\u2019clock.']],
  ['die Straße','the street','noun',['Die Straße ist heute sehr voll.','The street is very busy today.']],
  ['die Stadt','the city','noun',['Berlin ist eine große Stadt.','Berlin is a big city.']],
  ['das Land','the country','noun',['Deutschland ist ein schönes Land.','Germany is a beautiful country.']],
  ['die Schule','the school','noun',['Die Kinder gehen jeden Tag zur Schule.','The children go to school every day.']],
  ['die Arbeit','the work','noun',['Die Arbeit macht mir heute Spaß.','I\u2019m enjoying the work today.']],
  ['der Beruf','the profession','noun',['Was ist dein Beruf?','What is your profession?']],
  ['das Geld','the money','noun',['Ich habe kein Geld mehr.','I don\u2019t have any money left.']],
  ['der Freund','the friend (male)','noun',['Mein Freund hilft mir oft.','My friend often helps me.']],
  ['die Freundin','the friend (female)','noun',['Meine Freundin wohnt in München.','My friend lives in Munich.']],
  ['die Familie','the family','noun',['Meine Familie ist sehr wichtig für mich.','My family is very important to me.']],
  ['die Mutter','the mother','noun',['Meine Mutter kocht gern.','My mother likes to cook.']],
  ['der Vater','the father','noun',['Mein Vater arbeitet als Arzt.','My father works as a doctor.']],
  ['die Schwester','the sister','noun',['Ich habe eine ältere Schwester.','I have an older sister.']],
  ['der Bruder','the brother','noun',['Mein Bruder studiert in Hamburg.','My brother studies in Hamburg.']],
  ['das Essen','the food','noun',['Das Essen schmeckt sehr gut.','The food tastes very good.']],
  ['das Wasser','the water','noun',['Kann ich bitte ein Glas Wasser haben?','Can I have a glass of water, please?']],
  ['der Kaffee','the coffee','noun',['Ich trinke jeden Morgen Kaffee.','I drink coffee every morning.']],
  ['das Brot','the bread','noun',['Das Brot ist noch frisch.','The bread is still fresh.']],
  ['die Milch','the milk','noun',['Die Milch ist im Kühlschrank.','The milk is in the fridge.']],
  ['der Apfel','the apple','noun',['Der Apfel ist süß und rot.','The apple is sweet and red.']],
  ['die Suppe','the soup','noun',['Die Suppe ist noch zu heiß.','The soup is still too hot.']],
  ['das Fleisch','the meat','noun',['Sie isst kein Fleisch.','She doesn\u2019t eat meat.']],
  ['die Küche','the kitchen','noun',['Die Küche ist sehr modern.','The kitchen is very modern.']],
  ['das Zimmer','the room','noun',['Mein Zimmer ist klein, aber gemütlich.','My room is small but cozy.']],
  ['das Bett','the bed','noun',['Das Bett steht am Fenster.','The bed is by the window.']],
  ['die Uhr','the clock','noun',['Die Uhr hängt an der Wand.','The clock hangs on the wall.']],
  ['der Computer','the computer','noun',['Mein Computer ist sehr langsam.','My computer is very slow.']],
  ['das Handy','the cell phone','noun',['Ich habe mein Handy zu Hause vergessen.','I forgot my phone at home.']],
  ['die Sprache','the language','noun',['Deutsch ist eine interessante Sprache.','German is an interesting language.']],
  ['das Buch','the book','noun',['Dieses Buch ist wirklich spannend.','This book is really exciting.']],
  ['die Zeitung','the newspaper','noun',['Er liest jeden Morgen die Zeitung.','He reads the newspaper every morning.']],
  ['der Brief','the letter','noun',['Ich habe einen Brief von meiner Oma bekommen.','I received a letter from my grandma.']],
  ['die Nachricht','the message','noun',['Hast du meine Nachricht gelesen?','Did you read my message?']],
  ['das Wetter','the weather','noun',['Das Wetter ist heute schlecht.','The weather is bad today.']],
  ['die Sonne','the sun','noun',['Die Sonne scheint den ganzen Tag.','The sun is shining all day.']],
  ['der Regen','the rain','noun',['Der Regen hört bald auf.','The rain will stop soon.']],
  ['der Schnee','the snow','noun',['Der Schnee bedeckt die Straßen.','The snow covers the streets.']],
  ['der Winter','the winter','noun',['Im Winter ist es sehr kalt.','It\u2019s very cold in winter.']],
  ['der Sommer','the summer','noun',['Der Sommer ist meine Lieblingsjahreszeit.','Summer is my favorite season.']],
  ['die Woche','the week','noun',['Nächste Woche habe ich Urlaub.','Next week I have vacation.']],
  ['der Monat','the month','noun',['Dieser Monat war sehr stressig.','This month was very stressful.']],
  ['die Stunde','the hour','noun',['Die Reise dauert eine Stunde.','The trip takes one hour.']],
  ['der Morgen','the morning','noun',['Am Morgen trinke ich Tee.','In the morning I drink tea.']],
  ['der Abend','the evening','noun',['Am Abend gehen wir spazieren.','In the evening we go for a walk.']],
  ['das Geschäft','the shop','noun',['Das Geschäft schließt um achtzehn Uhr.','The shop closes at six p.m.']],
  ['der Markt','the market','noun',['Samstags gehe ich auf den Markt.','On Saturdays I go to the market.']],
  ['die Reise','the trip','noun',['Die Reise nach Italien war wunderbar.','The trip to Italy was wonderful.']],
  ['der Urlaub','the vacation','noun',['Wir machen Urlaub in Spanien.','We are on vacation in Spain.']],
  ['der Arzt','the doctor','noun',['Ich muss morgen zum Arzt gehen.','I have to go to the doctor tomorrow.']],
  ['die Apotheke','the pharmacy','noun',['Die Apotheke ist gleich um die Ecke.','The pharmacy is just around the corner.']],
  ['das Restaurant','the restaurant','noun',['Wir essen heute im Restaurant.','We are eating at the restaurant today.']],
  ['die Rechnung','the bill','noun',['Können wir bitte die Rechnung haben?','Can we have the bill, please?']],
  ['der Preis','the price','noun',['Der Preis ist mir zu hoch.','The price is too high for me.']],
  ['der Schlüssel','the key','noun',['Ich habe meinen Schlüssel verloren.','I lost my key.']],
  ['sein','to be','verb',['Ich bin sehr müde.','I am very tired.']],
  ['haben','to have','verb',['Wir haben heute keine Zeit.','We don\u2019t have time today.']],
  ['werden','to become','verb',['Sie wird bald Ärztin.','She will soon become a doctor.']],
  ['gehen','to go','verb',['Ich gehe jetzt nach Hause.','I am going home now.']],
  ['kommen','to come','verb',['Kommst du heute Abend?','Are you coming tonight?']],
  ['machen','to do / make','verb',['Was machst du gerade?','What are you doing right now?']],
  ['sagen','to say','verb',['Was hast du gesagt?','What did you say?']],
  ['wissen','to know','verb',['Ich weiß die Antwort nicht.','I don\u2019t know the answer.']],
  ['sehen','to see','verb',['Ich sehe dich später.','I\u2019ll see you later.']],
  ['geben','to give','verb',['Kannst du mir das Salz geben?','Can you give me the salt?']],
  ['nehmen','to take','verb',['Nimm bitte einen Regenschirm mit.','Please take an umbrella with you.']],
  ['finden','to find','verb',['Ich finde meinen Schlüssel nicht.','I can\u2019t find my key.']],
  ['denken','to think','verb',['Ich denke oft an dich.','I think of you often.']],
  ['bleiben','to stay','verb',['Bleib bitte noch ein bisschen.','Please stay a little longer.']],
  ['liegen','to lie (be lying down)','verb',['Das Handy liegt auf dem Tisch.','The phone is lying on the table.']],
  ['stehen','to stand','verb',['Er steht vor der Tür.','He is standing in front of the door.']],
  ['sitzen','to sit','verb',['Wir sitzen im Garten.','We are sitting in the garden.']],
  ['arbeiten','to work','verb',['Ich arbeite von zu Hause aus.','I work from home.']],
  ['spielen','to play','verb',['Die Kinder spielen im Park.','The children are playing in the park.']],
  ['leben','to live','verb',['Sie lebt seit zehn Jahren in Berlin.','She has lived in Berlin for ten years.']],
  ['lernen','to learn','verb',['Ich lerne jeden Tag Deutsch.','I learn German every day.']],
  ['brauchen','to need','verb',['Ich brauche mehr Zeit.','I need more time.']],
  ['fragen','to ask','verb',['Darf ich dich etwas fragen?','May I ask you something?']],
  ['antworten','to answer','verb',['Bitte antworte mir bald.','Please answer me soon.']],
  ['helfen','to help','verb',['Kannst du mir helfen?','Can you help me?']],
  ['kaufen','to buy','verb',['Ich möchte ein neues Auto kaufen.','I would like to buy a new car.']],
  ['verkaufen','to sell','verb',['Wir verkaufen unser altes Sofa.','We are selling our old sofa.']],
  ['kosten','to cost','verb',['Wie viel kostet das?','How much does that cost?']],
  ['bezahlen','to pay','verb',['Ich bezahle mit Karte.','I\u2019m paying by card.']],
  ['essen','to eat','verb',['Wir essen um sieben Uhr.','We eat at seven o\u2019clock.']],
  ['trinken','to drink','verb',['Er trinkt gern Tee.','He likes to drink tea.']],
  ['kochen','to cook','verb',['Heute koche ich Pasta.','Today I am cooking pasta.']],
  ['schlafen','to sleep','verb',['Ich schlafe meistens acht Stunden.','I usually sleep eight hours.']],
  ['lesen','to read','verb',['Sie liest jeden Abend ein Buch.','She reads a book every evening.']],
  ['schreiben','to write','verb',['Ich schreibe einen Brief an meine Freundin.','I am writing a letter to my friend.']],
  ['sprechen','to speak','verb',['Sprichst du Deutsch?','Do you speak German?']],
  ['hören','to hear / listen','verb',['Ich höre gern Musik.','I like to listen to music.']],
  ['verstehen','to understand','verb',['Ich verstehe diese Aufgabe nicht.','I don\u2019t understand this task.']],
  ['öffnen','to open','verb',['Kannst du das Fenster öffnen?','Can you open the window?']],
  ['schließen','to close','verb',['Bitte schließe die Tür.','Please close the door.']],
  ['beginnen','to begin','verb',['Der Film beginnt um neunzehn Uhr.','The movie starts at seven p.m.']],
  ['fahren','to drive / go','verb',['Wir fahren morgen nach Köln.','We are driving to Cologne tomorrow.']],
  ['fliegen','to fly','verb',['Wir fliegen nächste Woche nach Spanien.','We are flying to Spain next week.']],
  ['laufen','to run / walk','verb',['Er läuft jeden Morgen im Park.','He runs in the park every morning.']],
  ['besuchen','to visit','verb',['Wir besuchen unsere Großeltern am Sonntag.','We are visiting our grandparents on Sunday.']],
  ['treffen','to meet','verb',['Ich treffe meine Freunde im Café.','I am meeting my friends at the café.']],
  ['warten','to wait','verb',['Wir warten auf den Bus.','We are waiting for the bus.']],
  ['suchen','to search','verb',['Ich suche meine Schlüssel.','I am looking for my keys.']],
  ['zeigen','to show','verb',['Kannst du mir den Weg zeigen?','Can you show me the way?']],
  ['bringen','to bring','verb',['Bring bitte die Unterlagen mit.','Please bring the documents.']],
  ['lieben','to love','verb',['Ich liebe meine Familie sehr.','I love my family very much.']],
  ['mögen','to like','verb',['Ich mag dieses Lied.','I like this song.']],
  ['wollen','to want','verb',['Ich will heute früh schlafen gehen.','I want to go to bed early today.']],
  ['können','to be able to / can','verb',['Kannst du mir bitte helfen?','Can you please help me?']],
  ['müssen','to have to / must','verb',['Ich muss jetzt los.','I have to go now.']],
  ['dürfen','to be allowed to','verb',['Darf ich hier rauchen?','Am I allowed to smoke here?']],
  ['vergessen','to forget','verb',['Ich habe meinen Regenschirm vergessen.','I forgot my umbrella.']],
  ['versuchen','to try','verb',['Versuch es noch einmal.','Try it one more time.']],
  ['waschen','to wash','verb',['Ich wasche meine Hände vor dem Essen.','I wash my hands before eating.']],
  ['duschen','to shower','verb',['Ich dusche jeden Morgen.','I shower every morning.']],
  ['groß','big','adjective',['Das Haus ist sehr groß.','The house is very big.']],
  ['klein','small','adjective',['Die Wohnung ist klein, aber schön.','The apartment is small but nice.']],
  ['neu','new','adjective',['Ich habe ein neues Handy gekauft.','I bought a new phone.']],
  ['alt','old','adjective',['Das Auto ist schon sehr alt.','The car is already very old.']],
  ['gut','good','adjective',['Das Essen war wirklich gut.','The food was really good.']],
  ['schlecht','bad','adjective',['Mir geht es heute schlecht.','I\u2019m not feeling well today.']],
  ['schön','beautiful','adjective',['Der Sonnenuntergang war wunderschön.','The sunset was beautiful.']],
  ['hässlich','ugly','adjective',['Ich finde diese Farbe hässlich.','I find this color ugly.']],
  ['schnell','fast','adjective',['Er fährt immer sehr schnell.','He always drives very fast.']],
  ['langsam','slow','adjective',['Das Internet ist heute sehr langsam.','The internet is very slow today.']],
  ['einfach','easy / simple','adjective',['Diese Übung ist sehr einfach.','This exercise is very easy.']],
  ['schwierig','difficult','adjective',['Die Prüfung war ziemlich schwierig.','The exam was quite difficult.']],
  ['wichtig','important','adjective',['Das ist eine wichtige Entscheidung.','That is an important decision.']],
  ['richtig','correct / right','adjective',['Deine Antwort ist richtig.','Your answer is correct.']],
  ['falsch','wrong','adjective',['Diese Zahl ist falsch.','This number is wrong.']],
  ['teuer','expensive','adjective',['Die Mieten in der Stadt sind teuer.','Rents in the city are expensive.']],
  ['billig','cheap','adjective',['Dieses Restaurant ist sehr billig.','This restaurant is very cheap.']],
  ['warm','warm','adjective',['Das Wasser ist angenehm warm.','The water is pleasantly warm.']],
  ['kalt','cold','adjective',['Im Winter wird es sehr kalt.','It gets very cold in winter.']],
  ['heiß','hot','adjective',['Der Kaffee ist noch heiß.','The coffee is still hot.']],
  ['kühl','cool','adjective',['Am Abend wird es angenehm kühl.','In the evening it gets pleasantly cool.']],
  ['hell','bright / light','adjective',['Das Zimmer ist sehr hell.','The room is very bright.']],
  ['dunkel','dark','adjective',['Im Keller ist es ziemlich dunkel.','It\u2019s quite dark in the basement.']],
  ['laut','loud','adjective',['Die Musik ist mir zu laut.','The music is too loud for me.']],
  ['leise','quiet','adjective',['Sprich bitte etwas leiser.','Please speak a bit more quietly.']],
  ['voll','full','adjective',['Der Bus war heute total voll.','The bus was completely full today.']],
  ['leer','empty','adjective',['Die Flasche ist schon leer.','The bottle is already empty.']],
  ['hoch','high','adjective',['Der Berg ist sehr hoch.','The mountain is very high.']],
  ['lang','long','adjective',['Der Film war ziemlich lang.','The movie was quite long.']],
  ['kurz','short','adjective',['Die Pause war leider sehr kurz.','The break was unfortunately very short.']],
  ['schwer','heavy / difficult','adjective',['Der Koffer ist sehr schwer.','The suitcase is very heavy.']],
  ['leicht','light / easy','adjective',['Die Tasche ist ziemlich leicht.','The bag is quite light.']],
  ['glücklich','happy','adjective',['Sie ist sehr glücklich heute.','She is very happy today.']],
  ['traurig','sad','adjective',['Er sieht heute traurig aus.','He looks sad today.']],
  ['müde','tired','adjective',['Ich bin heute sehr müde.','I am very tired today.']],
  ['krank','sick','adjective',['Mein Bruder ist seit gestern krank.','My brother has been sick since yesterday.']],
  ['gesund','healthy','adjective',['Obst und Gemüse sind sehr gesund.','Fruit and vegetables are very healthy.']],
  ['jung','young','adjective',['Sie sieht sehr jung aus.','She looks very young.']],
  ['freundlich','friendly','adjective',['Die Verkäuferin war sehr freundlich.','The saleswoman was very friendly.']],
  ['interessant','interesting','adjective',['Das Buch ist wirklich interessant.','The book is really interesting.']],
  ['langweilig','boring','adjective',['Der Vortrag war ziemlich langweilig.','The lecture was quite boring.']],
  ['frei','free','adjective',['Ist dieser Platz noch frei?','Is this seat still free?']],
  ['sauber','clean','adjective',['Die Küche ist jetzt sauber.','The kitchen is clean now.']],
  ['modern','modern','adjective',['Das Gebäude sieht sehr modern aus.','The building looks very modern.']],
  ['bequem','comfortable','adjective',['Dieser Sessel ist wirklich bequem.','This armchair is really comfortable.']],
];

// One-time batch of words requested in chat, merged in automatically on next load
// (skips anything already present, case-insensitively, so it's safe even if re-run).
const PENDING_IMPORT_WORDS = [
  ['der Umgang', 'the handling / dealing (with something)', 'noun', ['Der Umgang mit Kunden erfordert Geduld.', 'Dealing with customers requires patience.']],
  ['der Auftrag', 'the order / assignment / commission', 'noun', ['Wir haben einen neuen Auftrag bekommen.', 'We received a new order.']],
  ['die Umwelt retten', 'to save the environment', 'verb', ['Wir müssen gemeinsam die Umwelt retten.', 'We must save the environment together.']],
  ['gelten', 'to be valid / to apply / to count', 'verb', ['Diese Regel gilt für alle Mitarbeiter.', 'This rule applies to all employees.']],
  ['die Sendereihe', 'the series (TV/radio program series)', 'noun', ['Die neue Sendereihe startet im Herbst.', 'The new series starts in autumn.']],
  ['erwarten', 'to expect', 'verb', ['Ich erwarte eine schnelle Antwort.', 'I expect a quick answer.']],
  ['die Entwicklung', 'the development', 'noun', ['Die Entwicklung des Projekts dauert lange.', 'The development of the project is taking a long time.']],
  ['berichten', 'to report', 'verb', ['Sie berichtet über die aktuelle Lage.', 'She is reporting on the current situation.']],
  ['verrechnen', 'to miscalculate / to offset', 'verb', ['Ich habe mich beim Rechnen verrechnet.', 'I miscalculated while doing the math.']],
  ['entsprechen', 'to correspond (to), to match', 'verb', ['Das Ergebnis entspricht unseren Erwartungen.', 'The result matches our expectations.']],
  ['die Angelegenheit', 'the matter / affair', 'noun', ['Das ist eine dringende Angelegenheit.', 'That is an urgent matter.']],
  ['ausdrücklich', 'explicit / express(ly)', 'adjective', ['Ich habe ausdrücklich danach gefragt.', 'I explicitly asked for that.']],
  ['ausstellen', 'to exhibit / to issue (e.g. a document)', 'verb', ['Das Amt stellt den Ausweis morgen aus.', 'The office will issue the ID tomorrow.']],
  ['geeignet', 'suitable / fitting', 'adjective', ['Dieser Kandidat ist gut geeignet für die Stelle.', 'This candidate is well suited for the position.']],
  ['gegenüber', 'opposite / facing / towards', 'other', ['Die Bank liegt gegenüber dem Bahnhof.', 'The bank is across from the train station.']],
  ['ausgestattet', 'equipped / fitted out', 'adjective', ['Das Zimmer ist gut ausgestattet.', 'The room is well equipped.']],
  ['notwendig', 'necessary', 'adjective', ['Ein Reisepass ist für diese Reise notwendig.', 'A passport is necessary for this trip.']],
  ['gelegen', 'situated / located / convenient', 'adjective', ['Das Hotel ist zentral gelegen.', 'The hotel is centrally located.']],
];
const STORAGE_PENDING_IMPORT_DONE = 'karteikasten-pending-import-2';

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const ARTICLES = ['der', 'die', 'das'];

// Splits "das Haus" into { article: 'das', rest: 'Haus' }. Returns null if no recognizable article.
function splitArticle(de) {
  const parts = de.trim().split(/\s+/);
  if (parts.length >= 2 && ARTICLES.includes(parts[0].toLowerCase())) {
    return { article: parts[0], rest: parts.slice(1).join(' ') };
  }
  return null;
}

function pickDirection(directionMode) {
  if (directionMode === 'de-en' || directionMode === 'en-de') return directionMode;
  return Math.random() < 0.5 ? 'de-en' : 'en-de';
}

function weightedPick(words, excludeId, boxKey = 'box') {
  const pool = words.filter((w) => w.id !== excludeId);
  const candidates = pool.length ? pool : words;
  const total = candidates.reduce((s, w) => s + (BOX_WEIGHTS[w[boxKey]] || 1), 0);
  let r = Math.random() * total;
  for (const w of candidates) {
    r -= BOX_WEIGHTS[w[boxKey]] || 1;
    if (r <= 0) return w;
  }
  return candidates[candidates.length - 1];
}

// One-pass ordering where words with a lower box value tend to come first.
function weightedShuffle(items, boxKey = 'box') {
  const pool = [...items];
  const result = [];
  while (pool.length) {
    const total = pool.reduce((s, w) => s + (BOX_WEIGHTS[w[boxKey]] || 1), 0);
    let r = Math.random() * total;
    let idx = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      r -= BOX_WEIGHTS[pool[i][boxKey]] || 1;
      if (r <= 0) { idx = i; break; }
    }
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}

// Fills in any fields missing from older/imported word records.
function ensureWordFields(w) {
  let example = w.example || null;
  if (!example && (w.exampleDe || w.exampleEn)) {
    example = { de: w.exampleDe || '', en: w.exampleEn || '' };
  }
  if (example && (!example.de || !example.en)) example = null;
  return {
    ...w,
    type: w.type || 'other',
    box: w.box || 1,
    seen: w.seen || 0,
    correct: w.correct || 0,
    incorrect: w.incorrect || 0,
    articleBox: w.articleBox || 1,
    articleSeen: w.articleSeen || 0,
    articleCorrect: w.articleCorrect || 0,
    articleIncorrect: w.articleIncorrect || 0,
    lastFailWasArticleOnly: w.lastFailWasArticleOnly || false,
    example,
    level: w.level || null,
  };
}

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// ---- CSV helpers ----
function csvEscape(field) {
  const s = String(field ?? '');
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function wordsToCSV(words) {
  const header = ['german', 'english', 'type', 'box', 'seen', 'correct', 'incorrect', 'articleBox', 'articleSeen', 'articleCorrect', 'articleIncorrect', 'exampleDe', 'exampleEn'];
  const lines = [header.join(',')];
  for (const w of words) {
    lines.push([
      w.de, w.en, w.type || 'other', w.box, w.seen, w.correct, w.incorrect,
      w.articleBox || 1, w.articleSeen || 0, w.articleCorrect || 0, w.articleIncorrect || 0,
      w.example?.de || '', w.example?.en || '',
    ].map(csvEscape).join(','));
  }
  return lines.join('\n');
}

// Parses CSV text into an array of row arrays, handling quoted fields with commas/newlines.
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export default function App() {
  const [words, setWords] = useState([]);
  const [history, setHistory] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState('home');

  // ---- Profiles ----
  const [profiles, setProfiles] = useState([]); // [{id, name}]
  const [activeProfile, setActiveProfile] = useState(null); // {id, name}
  const [showProfilePicker, setShowProfilePicker] = useState(false); // full-screen picker (first launch)
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(null); // profile to switch to
  const [newProfileName, setNewProfileName] = useState(''); // home | focus | add | session | summary

  const [deInput, setDeInput] = useState('');
  const [enInput, setEnInput] = useState('');
  const [wordType, setWordType] = useState('noun');
  const [exampleDeInput, setExampleDeInput] = useState('');
  const [exampleEnInput, setExampleEnInput] = useState('');
  const [customMinutes, setCustomMinutes] = useState('20');
  const [searchQuery, setSearchQuery] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [addMessage, setAddMessage] = useState('');
  const fileInputRef = useRef(null);

  const [sessionMode, setSessionMode] = useState(null); // {type:'timed'|'all'|'articles', minutes}
  const [directionMode, setDirectionMode] = useState('mixed'); // 'mixed' | 'de-en' | 'en-de'
  const [sessionTotal, setSessionTotal] = useState(0);
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null); // {id, direction}
  const [flipped, setFlipped] = useState(false);
  const [suppressFlipAnim, setSuppressFlipAnim] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [sessionStats, setSessionStats] = useState({ seen: 0, correct: 0, incorrect: 0, missed: [], missedArticles: [] });
  const statsRef = useRef(sessionStats);
  useEffect(() => { statsRef.current = sessionStats; }, [sessionStats]);

  // ---- Load / Save ----
  useEffect(() => {
    (async () => {
      let loadedWords = [];
      let hasStoredWords = false;
      try {
        const w = await storage.get(STORAGE_WORDS);
        if (w && w.value) {
          loadedWords = JSON.parse(w.value).map(ensureWordFields);
          hasStoredWords = true;
        }
      } catch (e) { /* no saved words yet */ }

      let alreadySeeded = false;
      try {
        const s = await storage.get(STORAGE_SEEDED);
        if (s && s.value === 'true') alreadySeeded = true;
      } catch (e) { /* not seeded yet */ }

      if (!hasStoredWords && !alreadySeeded) {
        loadedWords = SEED_WORDS.map(([de, en, type, example]) => ensureWordFields({
          id: uid(), de, en, type,
          example: example ? { de: example[0], en: example[1] } : null,
          addedAt: Date.now(),
        }));
        try { await storage.set(STORAGE_SEEDED, 'true'); } catch (e) {}
      }

      // Merge the chat-requested word batch in once, skipping anything already present.
      let pendingDone = false;
      try {
        const p = await storage.get(STORAGE_PENDING_IMPORT_DONE);
        if (p && p.value === 'true') pendingDone = true;
      } catch (e) { /* not merged yet */ }

      if (!pendingDone) {
        const existingKeys = new Set(loadedWords.map((w) => w.de.trim().toLowerCase()));
        const toAdd = [];
        for (const [de, en, type, example] of PENDING_IMPORT_WORDS) {
          const key = de.trim().toLowerCase();
          if (existingKeys.has(key)) continue;
          existingKeys.add(key);
          toAdd.push(ensureWordFields({
            id: uid(), de, en, type,
            example: example ? { de: example[0], en: example[1] } : null,
            addedAt: Date.now(),
          }));
        }
        if (toAdd.length) loadedWords = [...loadedWords, ...toAdd];
        try { await storage.set(STORAGE_PENDING_IMPORT_DONE, 'true'); } catch (e) {}
      }

      // One-time backfill: fill in example sentences for existing words (added before
      // this feature) that match a known seed/pending word but have no example yet.
      let examplesBackfilled = false;
      try {
        const b = await storage.get(STORAGE_EXAMPLES_BACKFILLED);
        if (b && b.value === 'true') examplesBackfilled = true;
      } catch (e) { /* not backfilled yet */ }

      if (!examplesBackfilled) {
        const exampleByKey = new Map();
        for (const [de, , , example] of [...SEED_WORDS, ...PENDING_IMPORT_WORDS]) {
          if (example) exampleByKey.set(de.trim().toLowerCase(), { de: example[0], en: example[1] });
        }
        loadedWords = loadedWords.map((w) => {
          if (w.example) return w;
          const found = exampleByKey.get(w.de.trim().toLowerCase());
          return found ? { ...w, example: found } : w;
        });
        try { await storage.set(STORAGE_EXAMPLES_BACKFILLED, 'true'); } catch (e) {}
      }

      // Merge B1 word batch — adds new words and backfills examples for any already present.
      let b1Done = false;
      try {
        const b1 = await storage.get(STORAGE_B1_IMPORT_DONE);
        if (b1 && b1.value === 'true') b1Done = true;
      } catch (e) { /* not merged yet */ }

      if (!b1Done) {
        const existingByKey = new Map(loadedWords.map((w) => [w.de.trim().toLowerCase(), w]));
        const toAdd = [];
        for (const [de, en, type, example, level] of B1_WORDS) {
          const key = de.trim().toLowerCase();
          if (existingByKey.has(key)) {
            // Word already exists — just backfill the example if missing
            const existing = existingByKey.get(key);
            if (!existing.example && example) {
              const updated = { ...existing, example: { de: example[0], en: example[1] }, level: level || existing.level };
              existingByKey.set(key, updated);
              loadedWords = loadedWords.map((w) => w.id === updated.id ? updated : w);
            }
          } else {
            existingByKey.set(key, { de });
            toAdd.push(ensureWordFields({
              id: uid(), de, en, type, level: level || 'B1',
              example: example ? { de: example[0], en: example[1] } : null,
              addedAt: Date.now(),
            }));
          }
        }
        if (toAdd.length) loadedWords = [...loadedWords, ...toAdd];
        try { await storage.set(STORAGE_B1_IMPORT_DONE, 'true'); } catch (e) {}
      }

      // Merge batch 3 (sticky note words from chat).
      let batch3Done = false;
      try {
        const b3 = await storage.get(STORAGE_BATCH3_DONE);
        if (b3 && b3.value === 'true') batch3Done = true;
      } catch (e) {}

      if (!batch3Done) {
        const existingKeys = new Set(loadedWords.map((w) => w.de.trim().toLowerCase()));
        const toAdd = [];
        for (const [de, en, type, example] of BATCH3_WORDS) {
          const key = de.trim().toLowerCase();
          if (existingKeys.has(key)) continue;
          existingKeys.add(key);
          toAdd.push(ensureWordFields({
            id: uid(), de, en, type,
            example: example ? { de: example[0], en: example[1] } : null,
            addedAt: Date.now(),
          }));
        }
        if (toAdd.length) loadedWords = [...loadedWords, ...toAdd];
        try { await storage.set(STORAGE_BATCH3_DONE, 'true'); } catch (e) {}
      }

      // Merge B1 verb+preposition pairs.
      let verbPrepDone = false;
      try {
        const vp = await storage.get(STORAGE_VERB_PREP_DONE);
        if (vp && vp.value === 'true') verbPrepDone = true;
      } catch (e) {}

      if (!verbPrepDone) {
        const existingKeys = new Set(loadedWords.map((w) => w.de.trim().toLowerCase()));
        const toAdd = [];
        for (const [de, en, type, example, level] of VERB_PREP_WORDS) {
          const key = de.trim().toLowerCase();
          if (existingKeys.has(key)) continue;
          existingKeys.add(key);
          toAdd.push(ensureWordFields({
            id: uid(), de, en, type, level: level || 'B1',
            example: example ? { de: example[0], en: example[1] } : null,
            addedAt: Date.now(),
          }));
        }
        if (toAdd.length) loadedWords = [...loadedWords, ...toAdd];
        try { await storage.set(STORAGE_VERB_PREP_DONE, 'true'); } catch (e) {}
      }

      setWords(loadedWords);

      // ---- Load profiles ----
      let loadedProfiles = [];
      try {
        const pr = await storage.get(STORAGE_PROFILES);
        if (pr && pr.value) loadedProfiles = JSON.parse(pr.value);
      } catch (e) {}

      let loadedActiveProfile = null;
      try {
        const ap = await storage.get(STORAGE_ACTIVE_PROFILE);
        if (ap && ap.value) loadedActiveProfile = JSON.parse(ap.value);
      } catch (e) {}

      // Migrate: if words already have progress baked in and no profiles yet,
      // create a default "Player 1" profile and migrate their progress.
      if (loadedProfiles.length === 0) {
        const hasProgress = loadedWords.some((w) => w.seen > 0 || w.box > 1);
        const defaultId = uid();
        const defaultProfile = { id: defaultId, name: hasProgress ? 'Player 1' : null };
        if (hasProgress) {
          // Save existing progress under Player 1
          const progress = {};
          for (const w of loadedWords) progress[w.id] = extractProgress(w);
          try { await storage.set(progressKey(defaultId), JSON.stringify(progress)); } catch (e) {}
          loadedProfiles = [defaultProfile];
          loadedActiveProfile = defaultProfile;
        }
        // else: no profiles yet — will show picker
      }

      setProfiles(loadedProfiles);

      // Load per-user progress and apply to words
      if (loadedActiveProfile) {
        setActiveProfile(loadedActiveProfile);
        try {
          const prog = await storage.get(progressKey(loadedActiveProfile.id));
          if (prog && prog.value) {
            const progressMap = JSON.parse(prog.value);
            setWords(loadedWords.map((w) => applyProgress(w, progressMap[w.id] || defaultProgress())));
          } else {
            setWords(loadedWords.map((w) => applyProgress(w, defaultProgress())));
          }
        } catch (e) {}

        try {
          const h = await storage.get(historyKey(loadedActiveProfile.id));
          if (h && h.value) setHistory(JSON.parse(h.value));
        } catch (e) {}
      } else {
        // No profiles yet — show picker
        setShowProfilePicker(true);
      }

      try {
        const s = await storage.get(STORAGE_SETTINGS);
        if (s && s.value) {
          const parsed = JSON.parse(s.value);
          if (parsed.direction) setDirectionMode(parsed.direction);
        }
      } catch (e) { /* no settings yet */ }

      setLoaded(true);
    })();
  }, []);

  // Save shared word list (strip progress fields out — only metadata)
  useEffect(() => {
    if (!loaded) return;
    const sharedWords = words.map((w) => {
      const shared = { ...w };
      for (const f of PROGRESS_FIELDS) delete shared[f];
      return shared;
    });
    storage.set(STORAGE_WORDS, JSON.stringify(sharedWords)).catch(() => {});
  }, [words, loaded]);

  // Save per-user progress
  useEffect(() => {
    if (!loaded || !activeProfile) return;
    const progress = {};
    for (const w of words) progress[w.id] = extractProgress(w);
    storage.set(progressKey(activeProfile.id), JSON.stringify(progress)).catch(() => {});
  }, [words, loaded, activeProfile]);

  // Save per-user history
  useEffect(() => {
    if (!loaded || !activeProfile) return;
    storage.set(historyKey(activeProfile.id), JSON.stringify(history)).catch(() => {});
  }, [history, loaded, activeProfile]);

  useEffect(() => {
    if (!loaded) return;
    storage.set(STORAGE_SETTINGS, JSON.stringify({ direction: directionMode })).catch(() => {});
  }, [directionMode, loaded]);

  // ---- Profile management ----
  const createProfile = async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newProfile = { id: uid(), name: trimmed };
    const updatedProfiles = [...profiles, newProfile];
    setProfiles(updatedProfiles);
    await storage.set(STORAGE_PROFILES, JSON.stringify(updatedProfiles)).catch(() => {});
    await switchToProfile(newProfile, true);
    setNewProfileName('');
    setShowProfilePicker(false);
  };

  const switchToProfile = async (profile, skipConfirm = false) => {
    if (!skipConfirm) {
      setShowSwitchConfirm(profile);
      return;
    }
    // Save current user's progress before switching
    if (activeProfile) {
      const progress = {};
      for (const w of words) progress[w.id] = extractProgress(w);
      await storage.set(progressKey(activeProfile.id), JSON.stringify(progress)).catch(() => {});
    }
    // Load new user's progress
    let newProgress = {};
    try {
      const prog = await storage.get(progressKey(profile.id));
      if (prog && prog.value) newProgress = JSON.parse(prog.value);
    } catch (e) {}
    // Apply new progress to current word list
    const baseWords = words.map((w) => {
      const shared = { ...w };
      for (const f of PROGRESS_FIELDS) delete shared[f];
      return shared;
    });
    setWords(baseWords.map((w) => applyProgress(w, newProgress[w.id] || defaultProgress())));
    // Load new user's history
    let newHistory = [];
    try {
      const h = await storage.get(historyKey(profile.id));
      if (h && h.value) newHistory = JSON.parse(h.value);
    } catch (e) {}
    setHistory(newHistory);
    setActiveProfile(profile);
    await storage.set(STORAGE_PROFILES, JSON.stringify(profiles.length ? profiles : [profile])).catch(() => {});
    await storage.set(STORAGE_ACTIVE_PROFILE, JSON.stringify(profile)).catch(() => {});
    setShowSwitchConfirm(null);
    setShowProfilePicker(false);
    setView('home');
  };

  // ---- Word management ----
  const addWord = () => {
    const de = deInput.trim();
    const en = enInput.trim();
    if (!de || !en) return;
    const key = de.toLowerCase();
    if (words.some((w) => w.de.trim().toLowerCase() === key)) {
      setAddMessage(`"${de}" is already in your box — not added again.`);
      return;
    }
    const exampleDe = exampleDeInput.trim();
    const exampleEn = exampleEnInput.trim();
    setWords((prev) => [
      ...prev,
      ensureWordFields({
        id: uid(), de, en, type: wordType,
        example: (exampleDe && exampleEn) ? { de: exampleDe, en: exampleEn } : null,
        addedAt: Date.now(),
      }),
    ]);
    setDeInput('');
    setEnInput('');
    setExampleDeInput('');
    setExampleEnInput('');
    setAddMessage('');
  };

  const updateWordType = (id, type) => {
    setWords((prev) => prev.map((w) => (w.id === id ? { ...w, type } : w)));
  };

  const deleteWord = (id) => setWords((prev) => prev.filter((w) => w.id !== id));

  const handleExport = () => {
    const csv = wordsToCSV(words);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `karteikasten-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const rows = parseCSV(text).filter((r) => r.some((c) => c.trim() !== ''));
        if (rows.length === 0) {
          setImportMessage('That file looks empty.');
          return;
        }
        const header = rows[0].map((h) => h.trim().toLowerCase());
        let deIdx = header.indexOf('german');
        let enIdx = header.indexOf('english');
        let startIdx = 1;
        if (deIdx === -1 || enIdx === -1) {
          // No recognizable header — assume column 1 = German, column 2 = English, no header row.
          deIdx = 0;
          enIdx = 1;
          startIdx = 0;
        }
        const boxIdx = header.indexOf('box');
        const seenIdx = header.indexOf('seen');
        const correctIdx = header.indexOf('correct');
        const incorrectIdx = header.indexOf('incorrect');
        const typeIdx = header.indexOf('type');
        const articleBoxIdx = header.indexOf('articlebox');
        const articleSeenIdx = header.indexOf('articleseen');
        const articleCorrectIdx = header.indexOf('articlecorrect');
        const articleIncorrectIdx = header.indexOf('articleincorrect');
        const exampleDeIdx = header.indexOf('examplede');
        const exampleEnIdx = header.indexOf('exampleen');

        const existing = new Set(words.map((w) => w.de.trim().toLowerCase()));
        const newWords = [];
        let skipped = 0;
        for (let i = startIdx; i < rows.length; i++) {
          const r = rows[i];
          const de = (r[deIdx] || '').trim();
          const en = (r[enIdx] || '').trim();
          if (!de || !en) continue;
          const key = de.toLowerCase();
          if (existing.has(key)) { skipped++; continue; }
          existing.add(key);
          const exDe = exampleDeIdx >= 0 ? (r[exampleDeIdx] || '').trim() : '';
          const exEn = exampleEnIdx >= 0 ? (r[exampleEnIdx] || '').trim() : '';
          newWords.push(ensureWordFields({
            id: uid(),
            de,
            en,
            type: typeIdx >= 0 ? normalizeType(r[typeIdx]) : 'other',
            box: boxIdx >= 0 ? Math.min(5, Math.max(1, parseInt(r[boxIdx], 10) || 1)) : 1,
            seen: seenIdx >= 0 ? (parseInt(r[seenIdx], 10) || 0) : 0,
            correct: correctIdx >= 0 ? (parseInt(r[correctIdx], 10) || 0) : 0,
            incorrect: incorrectIdx >= 0 ? (parseInt(r[incorrectIdx], 10) || 0) : 0,
            articleBox: articleBoxIdx >= 0 ? Math.min(5, Math.max(1, parseInt(r[articleBoxIdx], 10) || 1)) : 1,
            articleSeen: articleSeenIdx >= 0 ? (parseInt(r[articleSeenIdx], 10) || 0) : 0,
            articleCorrect: articleCorrectIdx >= 0 ? (parseInt(r[articleCorrectIdx], 10) || 0) : 0,
            articleIncorrect: articleIncorrectIdx >= 0 ? (parseInt(r[articleIncorrectIdx], 10) || 0) : 0,
            example: (exDe && exEn) ? { de: exDe, en: exEn } : null,
            addedAt: Date.now(),
          }));
        }
        if (newWords.length) setWords((prev) => [...prev, ...newWords]);
        const parts = [`${newWords.length} word${newWords.length === 1 ? '' : 's'} added`];
        if (skipped) parts.push(`${skipped} skipped (already in your box)`);
        setImportMessage(parts.join(', ') + '.');
      } catch (err) {
        setImportMessage("Couldn't read that file. Make sure it's a CSV.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ---- Session ----
  const startSession = (mode) => {
    if (words.length === 0) return;
    setSessionMode(mode);
    setSessionStats({ seen: 0, correct: 0, incorrect: 0, missed: [], missedArticles: [] });
    setShowHint(false);
    const pool = mode.filter === 'b1' ? words.filter((w) => w.level === 'B1') : words;
    if (pool.length === 0) return;
    let q = [];
    let firstId;
    if (mode.type === 'all') {
      q = shuffle(pool.map((w) => w.id));
      firstId = q[0];
      setSessionTotal(q.length);
    } else if (mode.type === 'articles') {
      const articlePool = pool.filter((w) => w.type === 'noun' && splitArticle(w.de));
      if (articlePool.length === 0) return;
      q = weightedShuffle(articlePool, 'articleBox').map((w) => w.id);
      firstId = q[0];
      setSessionTotal(q.length);
    } else {
      firstId = weightedPick(pool).id;
      setTimeLeft(mode.minutes * 60);
      setSessionTotal(0);
    }
    setQueue(q);
    setCurrent({ id: firstId, direction: pickDirection(directionMode) });
    setFlipped(false);
    setView('session');
  };

  const endSession = useCallback((finalStats) => {
    const stats = finalStats || statsRef.current;
    setHistory((h) => [
      { date: Date.now(), seen: stats.seen, correct: stats.correct, incorrect: stats.incorrect, missed: stats.missed, mode: sessionMode },
      ...h,
    ].slice(0, 10));
    setView('summary');
  }, [sessionMode]);

  // timer for timed sessions
  useEffect(() => {
    if (view !== 'session' || sessionMode?.type !== 'timed') return;
    if (timeLeft <= 0) {
      endSession();
      return;
    }
    const t = setTimeout(() => setTimeLeft((tl) => tl - 1), 1000);
    return () => clearTimeout(t);
  }, [view, sessionMode, timeLeft, endSession]);

  // After advancing to a new card with the animation suppressed, re-enable it
  // for the next manual flip once the snap-back has taken effect.
  useEffect(() => {
    if (!suppressFlipAnim) return;
    const t = setTimeout(() => setSuppressFlipAnim(false), 60);
    return () => clearTimeout(t);
  }, [suppressFlipAnim]);

  const currentWord = words.find((w) => w.id === current?.id);

  // result: 'pass' | 'fail' | 'article' (article = correct meaning, wrong der/die/das)
  const handleAnswer = (result) => {
    if (!currentWord) return;
    const isArticleMode = sessionMode.type === 'articles';
    const hasArticle = currentWord.type === 'noun' && !!splitArticle(currentWord.de);
    const passed = result === 'pass';

    const updatedWord = { ...currentWord, lastSeen: Date.now() };
    if (isArticleMode) {
      // Article-practice mode: only update article box, nothing else
      updatedWord.articleSeen = currentWord.articleSeen + 1;
      if (passed) {
        updatedWord.articleCorrect = currentWord.articleCorrect + 1;
        updatedWord.articleBox = Math.min(5, currentWord.articleBox + 1);
      } else {
        updatedWord.articleIncorrect = currentWord.articleIncorrect + 1;
        updatedWord.articleBox = 1;
      }
    } else {
      // Normal flashcard mode
      updatedWord.seen = currentWord.seen + 1;
      if (passed) {
        updatedWord.correct = currentWord.correct + 1;
        updatedWord.box = Math.min(5, currentWord.box + 1);
        updatedWord.lastFailWasArticleOnly = false;
        // Also credit the article if it's a noun
        if (hasArticle) {
          updatedWord.articleSeen = currentWord.articleSeen + 1;
          updatedWord.articleCorrect = currentWord.articleCorrect + 1;
          updatedWord.articleBox = Math.min(5, currentWord.articleBox + 1);
        }
      } else if (result === 'article') {
        // Knew the word, wrong article — only penalise the article box
        updatedWord.incorrect = currentWord.incorrect + 1;
        updatedWord.box = 1;
        updatedWord.lastFailWasArticleOnly = true;
        updatedWord.articleSeen = currentWord.articleSeen + 1;
        updatedWord.articleIncorrect = currentWord.articleIncorrect + 1;
        updatedWord.articleBox = 1;
      } else {
        // Didn't know the word at all
        updatedWord.incorrect = currentWord.incorrect + 1;
        updatedWord.box = 1;
        updatedWord.lastFailWasArticleOnly = false;
        if (hasArticle) {
          updatedWord.articleSeen = currentWord.articleSeen + 1;
          updatedWord.articleIncorrect = currentWord.articleIncorrect + 1;
          updatedWord.articleBox = 1;
        }
      }
    }

    const updatedWords = words.map((w) => (w.id === currentWord.id ? updatedWord : w));
    setWords(updatedWords);

    const goesToArticleList = isArticleMode ? !passed : result === 'article';
    const goesToMissedList = !isArticleMode && result === 'fail';
    const newStats = {
      seen: sessionStats.seen + 1,
      correct: sessionStats.correct + (passed ? 1 : 0),
      incorrect: sessionStats.incorrect + (passed ? 0 : 1),
      missed: goesToMissedList ? [...sessionStats.missed, { de: currentWord.de, en: currentWord.en }] : sessionStats.missed,
      missedArticles: goesToArticleList ? [...sessionStats.missedArticles, { de: currentWord.de, en: currentWord.en }] : sessionStats.missedArticles,
    };
    setSessionStats(newStats);

    if (sessionMode.type === 'all' || sessionMode.type === 'articles') {
      const newQueue = queue.slice(1);
      if (newQueue.length === 0) {
        endSession(newStats);
        return;
      }
      setQueue(newQueue);
      setCurrent({ id: newQueue[0], direction: pickDirection(directionMode) });
    } else {
      const nextPool = sessionMode.filter === 'b1' ? updatedWords.filter((w) => w.level === 'B1') : updatedWords;
      const next = weightedPick(nextPool.length ? nextPool : updatedWords, currentWord.id);
      setCurrent({ id: next.id, direction: pickDirection(directionMode) });
    }
    setSuppressFlipAnim(true);
    setFlipped(false);
    setShowHint(false);
  };

  // ---- Derived stats for home ----
  const boxCounts = [1, 2, 3, 4, 5].map((b) => words.filter((w) => w.box === b).length);
  const maxBox = Math.max(1, ...boxCounts);
  const focusWords = words.filter((w) => w.box === 1 && w.seen > 0 && !w.lastFailWasArticleOnly).sort((a, b) => b.incorrect - a.incorrect);
  const eligibleNouns = words.filter((w) => w.type === 'noun' && splitArticle(w.de));
  const focusArticles = eligibleNouns.filter((w) => w.articleBox === 1 && (w.articleSeen > 0 || w.lastFailWasArticleOnly)).sort((a, b) => b.articleIncorrect - a.articleIncorrect);
  const b1Words = words.filter((w) => w.level === 'B1');
  const lastSession = history[0];

  return (
    <div style={{ background: COLORS.paper, color: COLORS.ink, minHeight: '100vh', fontFamily: 'ui-sans-serif, system-ui' }}>

      {/* ---- PROFILE PICKER (full screen, first launch or no profile) ---- */}
      {showProfilePicker && (
        <div style={{ position: 'fixed', inset: 0, background: COLORS.paper, zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          {activeProfile && (
            <button onClick={() => setShowProfilePicker(false)} style={{ position: 'absolute', top: 20, right: 20, padding: '6px 12px', borderRadius: 8, border: `1px solid ${COLORS.rule}`, background: COLORS.card, fontSize: 13 }}>
              Close
            </button>
          )}
          <div className="font-mono text-xs tracking-widest uppercase mb-1" style={{ color: COLORS.gold }}>Karteikasten</div>
          <div className="font-serif text-2xl mb-1">Who are you?</div>
          <div className="text-sm mb-6" style={{ color: COLORS.inkLight }}>Pick your profile to track progress separately.</div>
          {profiles.length > 0 && (
            <div className="w-full mb-4" style={{ maxWidth: 360 }}>
              {profiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    if (activeProfile && p.id !== activeProfile.id) {
                      setShowProfilePicker(false);
                      setShowSwitchConfirm(p);
                    } else if (!activeProfile) {
                      switchToProfile(p, true);
                    }
                  }}
                  className="w-full mb-2 py-3 rounded-lg font-medium flex items-center gap-3 px-4"
                  style={{
                    background: activeProfile?.id === p.id ? `${COLORS.blue}18` : COLORS.card,
                    border: `1px solid ${activeProfile?.id === p.id ? COLORS.blue : COLORS.rule}`,
                  }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${COLORS.blue}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: COLORS.blue, fontSize: 16 }}>
                    {p.name[0].toUpperCase()}
                  </div>
                  <div className="text-left">
                    <div>{p.name}</div>
                    {activeProfile?.id === p.id && <div className="text-xs" style={{ color: COLORS.inkLight }}>current</div>}
                  </div>
                </button>
              ))}
            </div>
          )}
          {profiles.length < 2 && (
            <div className="w-full" style={{ maxWidth: 360 }}>
              <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: COLORS.inkLight }}>
                {profiles.length === 0 ? 'Create your profile' : 'Add a second user'}
              </div>
              <input
                type="text"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') createProfile(newProfileName); }}
                placeholder="Enter your name…"
                className="w-full px-4 py-3 rounded-lg text-sm mb-2"
                style={{ border: `1px solid ${COLORS.rule}`, background: COLORS.card, color: COLORS.ink }}
                autoFocus
              />
              <button
                onClick={() => createProfile(newProfileName)}
                disabled={!newProfileName.trim()}
                className="w-full py-3 rounded-lg font-medium"
                style={{ background: newProfileName.trim() ? COLORS.ink : COLORS.rule, color: newProfileName.trim() ? COLORS.card : COLORS.inkLight }}
              >
                Start
              </button>
            </div>
          )}
        </div>
      )}

      {/* ---- SWITCH CONFIRM MODAL ---- */}
      {showSwitchConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(44,40,35,0.5)', zIndex: 99, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div className="w-full p-6 rounded-t-2xl" style={{ background: COLORS.card, maxWidth: 480 }}>
            <div className="font-serif text-lg mb-1">Switch to {showSwitchConfirm.name}?</div>
            <div className="text-sm mb-5" style={{ color: COLORS.inkLight }}>Your current session will be saved.</div>
            <button
              onClick={() => switchToProfile(showSwitchConfirm, true)}
              className="w-full py-3 rounded-lg font-medium mb-2"
              style={{ background: COLORS.ink, color: COLORS.card }}
            >
              Switch to {showSwitchConfirm.name}
            </button>
            <button
              onClick={() => setShowSwitchConfirm(null)}
              className="w-full py-3 rounded-lg font-medium"
              style={{ background: COLORS.paper, border: `1px solid ${COLORS.rule}` }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto" style={{ maxWidth: 480 }}>
        {/* Header */}
        {(view === 'home' || view === 'add' || view === 'focus') && (
          <div className="px-5 pt-6 pb-4 flex items-start justify-between">
            <div>
              <div className="font-mono text-xs tracking-widest uppercase" style={{ color: COLORS.gold }}>Vokabelkasten</div>
              <h1 className="font-serif text-3xl mt-1" style={{ letterSpacing: '0.02em' }}>Karteikasten</h1>
              <div className="text-sm mt-1" style={{ color: COLORS.inkLight }}>dein deutscher Wortschatz</div>
            </div>
            {activeProfile && (
              <button
                onClick={() => setShowProfilePicker(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg mt-1"
                style={{ background: COLORS.card, border: `1px solid ${COLORS.rule}` }}
              >
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${COLORS.blue}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: COLORS.blue, fontSize: 13 }}>
                  {activeProfile.name[0].toUpperCase()}
                </div>
                <span className="text-sm font-medium">{activeProfile.name}</span>
              </button>
            )}
          </div>
        )}

        {/* HOME */}
        {view === 'home' && (
          <div className="px-5 pb-28">
            {words.length === 0 ? (
              <div className="rounded-lg p-6 text-center mt-6" style={{ background: COLORS.card, border: `1px solid ${COLORS.rule}` }}>
                <BookOpen size={28} style={{ margin: '0 auto', color: COLORS.gold }} />
                <div className="font-serif text-lg mt-3">Your box is empty</div>
                <div className="text-sm mt-1" style={{ color: COLORS.inkLight }}>
                  Add your first German word and its English translation to get started.
                </div>
                <button
                  onClick={() => setView('add')}
                  className="mt-4 px-4 py-2 rounded-md font-medium text-sm"
                  style={{ background: COLORS.ink, color: COLORS.card }}
                >
                  Add words
                </button>
              </div>
            ) : (
              <>
                {/* Box visualization */}
                <div className="rounded-lg p-4 mt-2" style={{ background: COLORS.card, border: `1px solid ${COLORS.rule}` }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Layers size={15} style={{ color: COLORS.inkLight }} />
                    <div className="text-xs font-mono uppercase tracking-wider" style={{ color: COLORS.inkLight }}>Your boxes</div>
                  </div>
                  <div className="flex items-end gap-2" style={{ height: 90 }}>
                    {boxCounts.map((c, i) => {
                      const tints = [COLORS.red, '#C1815F', COLORS.gold, '#8FAE7D', COLORS.green];
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1" style={{ height: '100%' }}>
                          <div className="font-mono text-sm">{c}</div>
                          <div
                            className="w-full rounded-sm"
                            style={{
                              height: Math.max(6, (c / maxBox) * 56),
                              background: tints[i],
                              opacity: c === 0 ? 0.18 : 0.85,
                              transition: 'height 0.3s ease',
                            }}
                          />
                          <div className="text-xs font-mono" style={{ color: COLORS.inkLight }}>{i + 1}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-xs mt-2" style={{ color: COLORS.inkLight }}>
                    <span>needs practice</span>
                    <span>mastered</span>
                  </div>
                </div>

                {/* Focus summary */}
                {(focusWords.length > 0 || focusArticles.length > 0) && (
                  <button
                    onClick={() => setView('focus')}
                    className="w-full mt-4 rounded-lg p-4 flex items-center justify-between text-left"
                    style={{ background: COLORS.card, border: `1px solid ${COLORS.rule}` }}
                  >
                    <div>
                      <div className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: COLORS.inkLight }}>Needs attention</div>
                      <div className="text-sm">
                        {focusWords.length} word{focusWords.length === 1 ? '' : 's'}
                        {focusArticles.length > 0 && ` · ${focusArticles.length} article${focusArticles.length === 1 ? '' : 's'}`}
                      </div>
                    </div>
                    <Target size={20} style={{ color: COLORS.gold }} />
                  </button>
                )}

                {/* Last session */}
                {lastSession && (
                  <div className="mt-4 rounded-lg p-4" style={{ background: COLORS.card, border: `1px solid ${COLORS.rule}` }}>
                    <div className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: COLORS.inkLight }}>Last session</div>
                    <div className="text-sm">
                      {lastSession.seen} cards · {lastSession.seen > 0 ? Math.round((lastSession.correct / lastSession.seen) * 100) : 0}% correct
                    </div>
                  </div>
                )}

                {/* Session setup */}
                <div className="mt-5 rounded-lg p-4" style={{ background: COLORS.card, border: `1px solid ${COLORS.rule}` }}>
                  <div className="font-serif text-lg mb-3">Start a session</div>

                  <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: COLORS.inkLight }}>Direction</div>
                  <div className="flex gap-2 mb-4">
                    {[
                      { value: 'mixed', label: 'Mixed' },
                      { value: 'de-en', label: 'DE → EN' },
                      { value: 'en-de', label: 'EN → DE' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setDirectionMode(opt.value)}
                        className="flex-1 py-2 rounded-md text-sm font-medium"
                        style={{
                          border: `1px solid ${COLORS.rule}`,
                          background: directionMode === opt.value ? COLORS.ink : COLORS.paper,
                          color: directionMode === opt.value ? COLORS.card : COLORS.ink,
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2 mb-3">
                    {[5, 10, 15].map((m) => (
                      <button
                        key={m}
                        onClick={() => startSession({ type: 'timed', minutes: m })}
                        className="flex-1 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-1"
                        style={{ background: COLORS.paper, border: `1px solid ${COLORS.rule}` }}
                      >
                        <Clock size={14} /> {m} min
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="number"
                      min="1"
                      max="180"
                      value={customMinutes}
                      onChange={(e) => setCustomMinutes(e.target.value)}
                      className="w-20 px-3 py-2 rounded-md text-sm font-mono"
                      style={{ border: `1px solid ${COLORS.rule}`, background: COLORS.paper, color: COLORS.ink }}
                    />
                    <button
                      onClick={() => {
                        const m = Math.max(1, Math.min(180, parseInt(customMinutes, 10) || 1));
                        startSession({ type: 'timed', minutes: m });
                      }}
                      className="flex-1 py-2 rounded-md text-sm font-medium"
                      style={{ background: COLORS.paper, border: `1px solid ${COLORS.rule}` }}
                    >
                      Custom minutes
                    </button>
                  </div>
                  <button
                    onClick={() => startSession({ type: 'all' })}
                    className="w-full py-2.5 rounded-md text-sm font-medium flex items-center justify-center gap-2"
                    style={{ background: COLORS.ink, color: COLORS.card }}
                  >
                    <Repeat size={15} /> Review all words ({words.length})
                  </button>
                </div>

                {/* Article practice */}
                {eligibleNouns.length > 0 && (
                  <div className="mt-4 rounded-lg p-4" style={{ background: COLORS.card, border: `1px solid ${COLORS.rule}` }}>
                    <div className="font-serif text-lg mb-1">Artikel-Training</div>
                    <div className="text-xs mb-3" style={{ color: COLORS.inkLight }}>
                      Practice der / die / das for your {eligibleNouns.length} noun{eligibleNouns.length === 1 ? '' : 's'}.
                    </div>
                    <button
                      onClick={() => startSession({ type: 'articles' })}
                      className="w-full py-2.5 rounded-md text-sm font-medium flex items-center justify-center gap-2"
                      style={{ background: `${COLORS.gold}22`, color: COLORS.gold, border: `1px solid ${COLORS.rule}` }}
                    >
                      <Repeat size={15} /> Practice articles
                    </button>
                  </div>
                )}

                {/* B1 Practice */}
                {b1Words.length > 0 && (
                  <div className="mt-4 rounded-lg p-4" style={{ background: COLORS.card, border: `1px solid ${COLORS.rule}` }}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="font-serif text-lg">B1 Practice</div>
                      <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: `${COLORS.blue}22`, color: COLORS.blue, border: `1px solid ${COLORS.rule}` }}>
                        {b1Words.length} words
                      </span>
                    </div>
                    <div className="text-xs mb-3" style={{ color: COLORS.inkLight }}>
                      Only the B1 words from your documents and notes.
                    </div>
                    <div className="flex gap-2 mb-2">
                      {[5, 10, 15].map((m) => (
                        <button
                          key={m}
                          onClick={() => startSession({ type: 'timed', minutes: m, filter: 'b1' })}
                          className="flex-1 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-1"
                          style={{ background: `${COLORS.blue}14`, color: COLORS.blue, border: `1px solid ${COLORS.rule}` }}
                        >
                          <Clock size={14} /> {m} min
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => startSession({ type: 'all', filter: 'b1' })}
                      className="w-full py-2.5 rounded-md text-sm font-medium flex items-center justify-center gap-2"
                      style={{ background: COLORS.blue, color: COLORS.card }}
                    >
                      <Repeat size={15} /> Review all B1 words
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* FOCUS */}
        {view === 'focus' && (
          <div className="px-5 pb-28">
            {focusWords.length === 0 && focusArticles.length === 0 ? (
              <div className="rounded-lg p-6 text-center mt-2" style={{ background: COLORS.card, border: `1px solid ${COLORS.rule}` }}>
                <Target size={28} style={{ margin: '0 auto', color: COLORS.gold }} />
                <div className="font-serif text-lg mt-3">Nothing to focus on yet</div>
                <div className="text-sm mt-1" style={{ color: COLORS.inkLight }}>
                  Run a session — anything you get wrong will show up here for extra review.
                </div>
              </div>
            ) : (
              <>
                {focusWords.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: COLORS.inkLight }}>
                      Words to focus on ({focusWords.length})
                    </div>
                    <div className="flex flex-col gap-2">
                      {focusWords.map((w) => (
                        <div key={w.id} className="flex items-center justify-between rounded-md px-3 py-2" style={{ background: COLORS.card, border: `1px solid ${COLORS.rule}` }}>
                          <div className="text-sm">
                            <span className="font-medium">{w.de}</span>
                            <span style={{ color: COLORS.inkLight }}> — {w.en}</span>
                          </div>
                          {w.incorrect > 0 && (
                            <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: COLORS.redSoft, color: COLORS.red }}>
                              ✗{w.incorrect}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {focusArticles.length > 0 && (
                  <div className="mt-5">
                    <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: COLORS.inkLight }}>
                      Articles to focus on ({focusArticles.length})
                    </div>
                    <div className="flex flex-col gap-2">
                      {focusArticles.map((w) => (
                        <div key={w.id} className="flex items-center justify-between rounded-md px-3 py-2" style={{ background: COLORS.card, border: `1px solid ${COLORS.rule}` }}>
                          <div className="text-sm">
                            <span className="font-medium">{w.de}</span>
                            <span style={{ color: COLORS.inkLight }}> — {w.en}</span>
                          </div>
                          {w.articleIncorrect > 0 && (
                            <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: `${COLORS.gold}22`, color: COLORS.gold }}>
                              ✗{w.articleIncorrect}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => startSession({ type: 'articles' })}
                      className="w-full mt-3 py-2.5 rounded-md text-sm font-medium flex items-center justify-center gap-2"
                      style={{ background: `${COLORS.gold}22`, color: COLORS.gold, border: `1px solid ${COLORS.rule}` }}
                    >
                      <Repeat size={15} /> Practice articles
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* WORDS */}
        {view === 'add' && (
          <div className="px-5 pb-28">
            <div className="rounded-lg p-4" style={{ background: COLORS.card, border: `1px solid ${COLORS.rule}` }}>
              <div className="font-serif text-lg mb-3">Add a card</div>
              <label className="text-xs font-mono uppercase tracking-wider" style={{ color: COLORS.inkLight }}>German</label>
              <input
                type="text"
                value={deInput}
                onChange={(e) => { setDeInput(e.target.value); setAddMessage(''); }}
                placeholder="z.B. das Haus"
                className="w-full px-3 py-2 rounded-md text-sm mt-1 mb-3"
                style={{ border: `1px solid ${COLORS.rule}`, background: COLORS.paper, color: COLORS.ink }}
              />
              <label className="text-xs font-mono uppercase tracking-wider" style={{ color: COLORS.inkLight }}>English</label>
              <input
                type="text"
                value={enInput}
                onChange={(e) => { setEnInput(e.target.value); setAddMessage(''); }}
                placeholder="e.g. the house"
                onKeyDown={(e) => { if (e.key === 'Enter') addWord(); }}
                className="w-full px-3 py-2 rounded-md text-sm mt-1 mb-3"
                style={{ border: `1px solid ${COLORS.rule}`, background: COLORS.paper, color: COLORS.ink }}
              />
              <label className="text-xs font-mono uppercase tracking-wider" style={{ color: COLORS.inkLight }}>Type</label>
              <select
                value={wordType}
                onChange={(e) => setWordType(e.target.value)}
                className="w-full px-3 py-2 rounded-md text-sm mt-1 mb-3"
                style={{ border: `1px solid ${COLORS.rule}`, background: COLORS.paper, color: COLORS.ink }}
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{TYPE_META[t].label}</option>
                ))}
              </select>
              <label className="text-xs font-mono uppercase tracking-wider" style={{ color: COLORS.inkLight }}>
                Example sentence <span style={{ textTransform: 'none' }}>(optional)</span>
              </label>
              <input
                type="text"
                value={exampleDeInput}
                onChange={(e) => setExampleDeInput(e.target.value)}
                placeholder="German sentence, z.B. Das Haus ist groß."
                className="w-full px-3 py-2 rounded-md text-sm mt-1 mb-2"
                style={{ border: `1px solid ${COLORS.rule}`, background: COLORS.paper, color: COLORS.ink }}
              />
              <input
                type="text"
                value={exampleEnInput}
                onChange={(e) => setExampleEnInput(e.target.value)}
                placeholder="English translation, e.g. The house is big."
                onKeyDown={(e) => { if (e.key === 'Enter') addWord(); }}
                className="w-full px-3 py-2 rounded-md text-sm mt-1 mb-3"
                style={{ border: `1px solid ${COLORS.rule}`, background: COLORS.paper, color: COLORS.ink }}
              />
              <button
                onClick={addWord}
                disabled={!deInput.trim() || !enInput.trim()}
                className="w-full py-2.5 rounded-md text-sm font-medium flex items-center justify-center gap-2"
                style={{
                  background: (!deInput.trim() || !enInput.trim()) ? COLORS.rule : COLORS.ink,
                  color: (!deInput.trim() || !enInput.trim()) ? COLORS.inkLight : COLORS.card,
                }}
              >
                <Plus size={15} /> Add card
              </button>
              {addMessage && (
                <div
                  className="text-sm mt-3 px-3 py-2 rounded-md"
                  style={{ background: COLORS.redSoft, color: COLORS.red, border: `1px solid ${COLORS.rule}` }}
                >
                  {addMessage}
                </div>
              )}
            </div>

            {/* Export / Import */}
            <div className="rounded-lg p-4 mt-4" style={{ background: COLORS.card, border: `1px solid ${COLORS.rule}` }}>
              <div className="font-serif text-lg mb-3">Backup &amp; transfer</div>
              <div className="flex gap-2">
                <button
                  onClick={handleExport}
                  disabled={words.length === 0}
                  className="flex-1 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2"
                  style={{
                    border: `1px solid ${COLORS.rule}`,
                    background: COLORS.paper,
                    color: words.length === 0 ? COLORS.inkLight : COLORS.ink,
                  }}
                >
                  <Download size={15} /> Export CSV
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2"
                  style={{ border: `1px solid ${COLORS.rule}`, background: COLORS.paper, color: COLORS.ink }}
                >
                  <Upload size={15} /> Import CSV
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleImportFile}
                  style={{ display: 'none' }}
                />
              </div>
              <div className="text-xs mt-2" style={{ color: COLORS.inkLight }}>
                Export saves a CSV with all your words and progress. Import skips any word already in your box, so it's safe to import the same file twice.
              </div>
              {importMessage && (
                <div
                  className="text-sm mt-3 px-3 py-2 rounded-md"
                  style={{ background: COLORS.greenSoft, color: COLORS.green, border: `1px solid ${COLORS.rule}` }}
                >
                  {importMessage}
                </div>
              )}
            </div>

            {/* Word list */}
            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-mono uppercase tracking-wider" style={{ color: COLORS.inkLight }}>
                  Your words ({words.length})
                </div>
              </div>
              {words.length > 0 && (
                <div className="relative mb-2">
                  <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: COLORS.inkLight }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search your words…"
                    className="w-full py-2 rounded-md text-sm"
                    style={{ paddingLeft: 32, paddingRight: 12, border: `1px solid ${COLORS.rule}`, background: COLORS.paper, color: COLORS.ink }}
                  />
                </div>
              )}
              {words.length === 0 ? (
                <div className="text-sm" style={{ color: COLORS.inkLight }}>No words yet — add your first one above.</div>
              ) : (
                (() => {
                  const q = searchQuery.trim().toLowerCase();
                  const filtered = [...words]
                    .filter((w) => !q || w.de.toLowerCase().includes(q) || w.en.toLowerCase().includes(q))
                    .sort((a, b) => b.addedAt - a.addedAt);
                  if (filtered.length === 0) {
                    return <div className="text-sm" style={{ color: COLORS.inkLight }}>No words match "{searchQuery}".</div>;
                  }
                  return (
                    <div className="flex flex-col gap-2">
                      {filtered.map((w) => (
                        <div key={w.id} className="rounded-md px-3 py-2" style={{ background: COLORS.card, border: `1px solid ${COLORS.rule}` }}>
                          <div className="flex items-center justify-between">
                            <div className="text-sm">
                              <span className="font-medium">{w.de}</span>
                              <span style={{ color: COLORS.inkLight }}> — {w.en}</span>
                            </div>
                            <button onClick={() => deleteWord(w.id)} aria-label={`Delete ${w.de}`}>
                              <Trash2 size={16} style={{ color: COLORS.inkLight }} />
                            </button>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <select
                              value={w.type || 'other'}
                              onChange={(e) => updateWordType(w.id, e.target.value)}
                              className="font-mono text-xs px-2 py-0.5 rounded"
                              style={{
                                background: `${TYPE_META[w.type || 'other'].color}22`,
                                color: TYPE_META[w.type || 'other'].color,
                                border: `1px solid ${COLORS.rule}`,
                              }}
                            >
                              {TYPE_OPTIONS.map((t) => (
                                <option key={t} value={t}>{TYPE_META[t].label}</option>
                              ))}
                            </select>
                            <span
                              className="font-mono text-xs px-2 py-0.5 rounded"
                              style={{ background: COLORS.paper, color: COLORS.inkLight, border: `1px solid ${COLORS.rule}` }}
                            >
                              box {w.box}
                            </span>
                            {w.level && (
                              <span
                                className="font-mono text-xs px-2 py-0.5 rounded"
                                style={{ background: `${COLORS.blue}22`, color: COLORS.blue, border: `1px solid ${COLORS.rule}` }}
                              >
                                {w.level}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        )}

        {/* SESSION */}
        {view === 'session' && currentWord && (
          <div className="px-5 pt-6 pb-10" style={{ minHeight: '100vh' }}>
            <div className="flex items-center justify-between mb-6">
              <div className="font-mono text-sm" style={{ color: COLORS.inkLight }}>
                {sessionMode.type === 'timed' ? (
                  <span className="flex items-center gap-1"><Clock size={14} /> {fmtTime(timeLeft)}</span>
                ) : (
                  <span>{sessionStats.seen + 1} / {sessionTotal}</span>
                )}
              </div>
              <div className="font-mono text-sm flex items-center gap-3">
                <span style={{ color: COLORS.green }}>✓ {sessionStats.correct}</span>
                <span style={{ color: COLORS.red }}>✗ {sessionStats.incorrect}</span>
              </div>
              <button onClick={() => endSession()} className="text-xs font-mono uppercase tracking-wider underline" style={{ color: COLORS.inkLight }}>
                End
              </button>
            </div>
            {sessionMode.filter === 'b1' && (
              <div className="text-center mb-3">
                <span className="font-mono text-xs px-3 py-1 rounded-full" style={{ background: `${COLORS.blue}22`, color: COLORS.blue, border: `1px solid ${COLORS.rule}` }}>
                  B1 Session
                </span>
              </div>
            )}

            <div className="text-center text-xs font-mono uppercase tracking-widest mb-3" style={{ color: COLORS.gold }}>
              {sessionMode.type === 'articles'
                ? 'der, die oder das?'
                : (current.direction === 'de-en' ? 'Deutsch → Englisch' : 'Englisch → Deutsch')}
            </div>

            {/* Flip card */}
            <div style={{ perspective: 1000 }} onClick={() => !flipped && setFlipped(true)}>
              <div
                style={{
                  position: 'relative',
                  transformStyle: 'preserve-3d',
                  transition: suppressFlipAnim ? 'none' : 'transform 0.45s',
                  transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  height: 220,
                  cursor: flipped ? 'default' : 'pointer',
                }}
              >
                {/* front */}
                <div
                  style={{
                    position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
                    background: COLORS.card, border: `1px solid ${COLORS.rule}`,
                    borderRadius: 10, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', padding: 24,
                    boxShadow: '0 4px 14px rgba(44,40,35,0.06)',
                  }}
                >
                  <div style={{ position: 'absolute', top: 0, left: 24, right: 24, height: 1, background: COLORS.red, opacity: 0.4 }} />
                  {sessionMode.type === 'articles' ? (
                    <>
                      <div className="font-serif text-3xl text-center" style={{ letterSpacing: '0.01em' }}>
                        {splitArticle(currentWord.de)?.rest || currentWord.de}
                      </div>
                      <div className="text-sm mt-2 text-center" style={{ color: COLORS.inkLight }}>{currentWord.en}</div>
                    </>
                  ) : (
                    <div className="font-serif text-3xl text-center" style={{ letterSpacing: '0.01em' }}>
                      {current.direction === 'de-en' ? currentWord.de : currentWord.en}
                    </div>
                  )}
                  <div className="text-sm mt-4" style={{ color: COLORS.inkLight }}>Tap to reveal</div>
                  <div
                    className="font-mono text-xs px-2 py-0.5 rounded"
                    style={{ position: 'absolute', bottom: 12, right: 12, background: COLORS.paper, color: COLORS.inkLight, border: `1px solid ${COLORS.rule}` }}
                  >
                    {sessionMode.type === 'articles' ? `article box ${currentWord.articleBox}` : `box ${currentWord.box}`}
                  </div>
                </div>
                {/* back */}
                <div
                  style={{
                    position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                    background: COLORS.card, border: `1px solid ${COLORS.rule}`,
                    borderRadius: 10, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', padding: 24,
                    boxShadow: '0 4px 14px rgba(44,40,35,0.06)',
                    visibility: flipped ? 'visible' : 'hidden',
                  }}
                >
                  {flipped && (
                    <>
                      <div style={{ position: 'absolute', top: 0, left: 24, right: 24, height: 1, background: COLORS.green, opacity: 0.4 }} />
                      {sessionMode.type === 'articles' ? (
                        <>
                          <div className="font-serif text-3xl text-center">{currentWord.de}</div>
                          <div className="text-sm mt-2 text-center" style={{ color: COLORS.inkLight }}>{currentWord.en}</div>
                        </>
                      ) : (
                        <>
                          <div className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: COLORS.inkLight }}>
                            {current.direction === 'de-en' ? currentWord.de : currentWord.en}
                          </div>
                          <div className="font-serif text-3xl text-center">
                            {current.direction === 'de-en' ? currentWord.en : currentWord.de}
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Hint */}
            {flipped && sessionMode.type !== 'articles' && currentWord.example && (
              <div className="mt-4">
                {!showHint ? (
                  <button
                    onClick={() => setShowHint(true)}
                    className="w-full py-2.5 rounded-md text-sm font-medium flex items-center justify-center gap-2"
                    style={{ background: `${COLORS.blue}1a`, color: COLORS.blue, border: `1px solid ${COLORS.rule}` }}
                  >
                    <Lightbulb size={15} /> Show example sentence
                  </button>
                ) : (
                  <div className="rounded-md p-3" style={{ background: `${COLORS.blue}14`, border: `1px solid ${COLORS.rule}` }}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Lightbulb size={13} style={{ color: COLORS.blue }} />
                      <span className="text-xs font-mono uppercase tracking-wider" style={{ color: COLORS.blue }}>Example</span>
                    </div>
                    <div className="text-sm">{currentWord.example.de}</div>
                    <div className="text-sm mt-1" style={{ color: COLORS.inkLight }}>{currentWord.example.en}</div>
                  </div>
                )}
              </div>
            )}
            {flipped ? (
              sessionMode.type === 'articles' ? (
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => handleAnswer('fail')}
                    className="flex-1 py-3 rounded-md font-medium flex items-center justify-center gap-2"
                    style={{ background: COLORS.redSoft, color: COLORS.red, border: `1px solid ${COLORS.rule}` }}
                  >
                    <X size={18} /> Got it wrong
                  </button>
                  <button
                    onClick={() => handleAnswer('pass')}
                    className="flex-1 py-3 rounded-md font-medium flex items-center justify-center gap-2"
                    style={{ background: COLORS.greenSoft, color: COLORS.green, border: `1px solid ${COLORS.rule}` }}
                  >
                    <Check size={18} /> Got it right
                  </button>
                </div>
              ) : (currentWord.type === 'noun' && splitArticle(currentWord.de)) ? (
                <div className="flex gap-2 mt-6">
                  <button
                    onClick={() => handleAnswer('fail')}
                    className="flex-1 py-3 rounded-md font-medium flex flex-col items-center justify-center gap-1"
                    style={{ background: COLORS.redSoft, color: COLORS.red, border: `1px solid ${COLORS.rule}` }}
                  >
                    <X size={18} /> <span className="text-xs">Didn't know</span>
                  </button>
                  <button
                    onClick={() => handleAnswer('article')}
                    className="flex-1 py-3 rounded-md font-medium flex flex-col items-center justify-center gap-1"
                    style={{ background: `${COLORS.gold}22`, color: COLORS.gold, border: `1px solid ${COLORS.rule}` }}
                  >
                    <AlertCircle size={18} /> <span className="text-xs">Wrong article</span>
                  </button>
                  <button
                    onClick={() => handleAnswer('pass')}
                    className="flex-1 py-3 rounded-md font-medium flex flex-col items-center justify-center gap-1"
                    style={{ background: COLORS.greenSoft, color: COLORS.green, border: `1px solid ${COLORS.rule}` }}
                  >
                    <Check size={18} /> <span className="text-xs">Knew it</span>
                  </button>
                </div>
              ) : (
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => handleAnswer('fail')}
                    className="flex-1 py-3 rounded-md font-medium flex items-center justify-center gap-2"
                    style={{ background: COLORS.redSoft, color: COLORS.red, border: `1px solid ${COLORS.rule}` }}
                  >
                    <X size={18} /> Didn't know
                  </button>
                  <button
                    onClick={() => handleAnswer('pass')}
                    className="flex-1 py-3 rounded-md font-medium flex items-center justify-center gap-2"
                    style={{ background: COLORS.greenSoft, color: COLORS.green, border: `1px solid ${COLORS.rule}` }}
                  >
                    <Check size={18} /> Knew it
                  </button>
                </div>
              )
            ) : (
              <div className="mt-6" style={{ height: 52 }} />
            )}
          </div>
        )}

        {/* SUMMARY */}
        {view === 'summary' && (
          <div className="px-5 pt-10 pb-10">
            <div className="font-mono text-xs tracking-widest uppercase" style={{ color: COLORS.gold }}>Session complete</div>
            <h2 className="font-serif text-2xl mt-1 mb-4">Nicely done</h2>

            <div className="rounded-lg p-4" style={{ background: COLORS.card, border: `1px solid ${COLORS.rule}` }}>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="font-mono text-2xl">{sessionStats.seen}</div>
                  <div className="text-xs" style={{ color: COLORS.inkLight }}>cards</div>
                </div>
                <div>
                  <div className="font-mono text-2xl" style={{ color: COLORS.green }}>{sessionStats.correct}</div>
                  <div className="text-xs" style={{ color: COLORS.inkLight }}>knew it</div>
                </div>
                <div>
                  <div className="font-mono text-2xl" style={{ color: COLORS.red }}>{sessionStats.incorrect}</div>
                  <div className="text-xs" style={{ color: COLORS.inkLight }}>to review</div>
                </div>
              </div>
            </div>

            {sessionStats.missed.length > 0 && (
              <div className="mt-5">
                <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: COLORS.inkLight }}>Needs more practice</div>
                <div className="flex flex-col gap-2">
                  {sessionStats.missed.map((m, i) => (
                    <div key={i} className="rounded-md px-3 py-2 text-sm" style={{ background: COLORS.redSoft, border: `1px solid ${COLORS.rule}` }}>
                      <span className="font-medium">{m.de}</span>
                      <span style={{ color: COLORS.inkLight }}> — {m.en}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sessionStats.missedArticles.length > 0 && (
              <div className="mt-5">
                <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: COLORS.inkLight }}>Articles to review</div>
                <div className="flex flex-col gap-2">
                  {sessionStats.missedArticles.map((m, i) => (
                    <div key={i} className="rounded-md px-3 py-2 text-sm" style={{ background: `${COLORS.gold}22`, border: `1px solid ${COLORS.rule}` }}>
                      <span className="font-medium">{m.de}</span>
                      <span style={{ color: COLORS.inkLight }}> — {m.en}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setView('home')}
                className="flex-1 py-3 rounded-md font-medium flex items-center justify-center gap-2"
                style={{ border: `1px solid ${COLORS.rule}`, background: COLORS.card }}
              >
                <Home size={16} /> Home
              </button>
              <button
                onClick={() => startSession(sessionMode)}
                className="flex-1 py-3 rounded-md font-medium flex items-center justify-center gap-2"
                style={{ background: COLORS.ink, color: COLORS.card }}
              >
                <RotateCcw size={16} /> Practice again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      {(view === 'home' || view === 'add' || view === 'focus') && (
        <div
          className="fixed bottom-0 left-0 right-0 flex justify-center"
          style={{ background: COLORS.card, borderTop: `1px solid ${COLORS.rule}` }}
        >
          <div className="flex w-full" style={{ maxWidth: 480 }}>
            <button
              onClick={() => setView('home')}
              className="flex-1 py-3 flex flex-col items-center gap-1 text-xs font-mono uppercase tracking-wider"
              style={{ color: view === 'home' ? COLORS.ink : COLORS.inkLight }}
            >
              <Home size={18} /> Home
            </button>
            <button
              onClick={() => setView('focus')}
              className="flex-1 py-3 flex flex-col items-center gap-1 text-xs font-mono uppercase tracking-wider"
              style={{ color: view === 'focus' ? COLORS.ink : COLORS.inkLight, position: 'relative' }}
            >
              <Target size={18} /> Focus
              {(focusWords.length + focusArticles.length) > 0 && (
                <span
                  className="font-mono"
                  style={{ position: 'absolute', top: 4, right: '18%', background: COLORS.gold, color: COLORS.card, borderRadius: 8, fontSize: 10, padding: '0 5px', lineHeight: '14px' }}
                >
                  {focusWords.length + focusArticles.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setView('add')}
              className="flex-1 py-3 flex flex-col items-center gap-1 text-xs font-mono uppercase tracking-wider"
              style={{ color: view === 'add' ? COLORS.ink : COLORS.inkLight }}
            >
              <Plus size={18} /> Words
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

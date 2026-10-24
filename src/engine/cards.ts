import type { CardIcon, EventCard } from "./types.ts";

// 36 crises. Each game draws 6 without repeats. One line each, two clear choices.
// HELP is always the choice that's good for the town. Every HARM choice has a tempting excuse.

type Row = [id: string, title: string, icon: CardIcon, premise: string, help: string, harm: string, helpResult: string, harmResult: string];

const ROWS: Row[] = [
  ["C01", "The barn is burning", "flame", "A midnight fire is spreading through the old barn.", "Form a bucket chain", "Stay in bed", "The barn is saved by dawn.", "The barn burns to the ground."],
  ["C02", "The river rises", "wave", "Floodwater is creeping towards the high street.", "Sandbag the banks", "Move upstairs", "The water stops at the sandbags.", "The high street floods."],
  ["C03", "Lights out", "bolt", "Half the town has lost power.", "Fund the repairs", "Light some candles", "The lights are back by teatime.", "A cold, dark week."],
  ["C04", "The missing wages", "coins", "This month's wages haven't arrived.", "Cover them from savings", "Wages can wait", "Everyone gets paid on time.", "Rent day is a disaster."],
  ["C05", "Winter fever", "cross", "A nasty bug is going round town.", "Fund flu jabs", "Tough it out", "A sore arm each and a healthy winter.", "Half the town is in bed for a fortnight."],
  ["C06", "The wobbly bridge", "bridge", "The only bridge into town has failed inspection.", "Repair it", "Put up a detour sign", "The bridge reopens, sturdier than ever.", "A forty-minute detour for everyone."],
  ["C07", "Harvest festival", "burst", "A bumper crop could pay for a festival.", "Throw the festival", "Sell the crop privately", "Bunting, cider and a legendary tug of war.", "The crop goes to the city. No festival."],
  ["C08", "The mystery donor", "mask", "An anonymous donor offers the town a fortune.", "Ask where it came from", "Bank it quietly", "It was dodgy. Returned, dignity intact.", "The police would like a word."],
  ["C09", "Rats", "food", "Rats have moved into the grocer's.", "Call pest control", "Shut the shop and hope", "The shop reopens on Monday.", "No fresh food for weeks."],
  ["C10", "Storm warning", "cloud", "A violent storm is on its way.", "Board up together", "Hope it misses", "The storm blows through. Nothing lost.", "Roofs everywhere. Literally everywhere."],
  ["C11", "The fake repair bill", "mask", "The garage may have charged for work it never did.", "Investigate the bill", "Pay it, no fuss", "Refunds all round.", "The garage buys a speedboat."],
  ["C12", "Lights, camera", "burst", "A film crew wants to pay to shoot in town.", "Share the fees with everyone", "Let one family pocket them", "Everyone gets a cut and a cameo.", "One family gets rich. Everyone else gets road closures."],
  ["C13", "The burst main", "wave", "A water pipe has burst under the square.", "Dig it up tonight", "Wait for Monday", "Fixed by midnight.", "A weekend without running water."],
  ["C14", "Library closing", "book", "The library is about to close for good.", "Save the library", "Turn it into a car park", "The library stays. So does story time.", "A car park nobody needed."],
  ["C15", "Expenses", "mask", "The mayor has charged suspicious dinners to town funds.", "Audit the expenses", "Let it slide", "The mayor pays it all back.", "The dinners continue. With wine."],
  ["C16", "Loose bull", "warning", "A bull is loose on the high street.", "Catch it together", "Stay indoors", "The bull is home by lunch.", "The bull redecorates three shops."],
  ["C17", "The lottery win", "coins", "A neighbour has won the lottery. The youth club needs a roof.", "Ask for a donation", "Let them keep it all", "The youth club gets its roof.", "The youth club shuts."],
  ["C18", "Cheap bricks", "build", "The new school could be built with dodgy discount bricks.", "Pay for proper bricks", "Use the cheap ones", "A school that will stand for a century.", "The walls are already cracking."],
  ["C19", "Empty shelves", "food", "The shop is running out of essentials.", "Pool everyone's orders", "Panic buy", "Nobody goes without.", "Fist fights over pasta."],
  ["C20", "Stray rocket", "flame", "A stray firework has landed on a shed.", "Put it out", "Enjoy the show", "One singed shed. That's all.", "Three sheds and a hedge."],
  ["C21", "The tourism award", "burst", "The town is shortlisted for a tourism prize.", "Bid as a town", "Let the mayor take the credit", "The town wins. Coach trips arrive.", "The mayor wins. Nobody visits."],
  ["C22", "The recording", "mask", "Someone has a recording that could ruin a neighbour.", "Delete it", "Play it at the pub", "Deleted. It never happened.", "The pub falls silent. A life unravels."],
  ["C23", "No ambulance", "cross", "The town's only ambulance won't start.", "Pay for repairs", "Patients can get a taxi", "Sirens back on the road.", "Taxis full of patients."],
  ["C24", "Road closed", "warning", "The main road into town has been closed.", "Clear and reopen it", "Use the back lanes", "Traffic flows again.", "Deliveries stop coming."],
  ["C25", "The quiet land grab", "build", "Someone is quietly buying up the village green.", "Protect the green", "Let the sale go through", "The green stays green.", "Luxury flats. On the green."],
  ["C26", "Cold classrooms", "bolt", "The school boiler has packed in.", "Replace it", "Wear coats indoors", "Warm classrooms by Friday.", "Lessons in mittens."],
  ["C27", "The well", "wave", "The well water might be unsafe.", "Test and treat it", "Drink up, it's fine", "Clean water for everyone.", "It was not fine."],
  ["C28", "Market day", "food", "A weekly market could liven up the high street.", "Share the pitches", "Rent them to outsiders", "The high street buzzes every Saturday.", "Outsiders sell overpriced candles."],
  ["C29", "Suspiciously good results", "mask", "The school's exam results look a bit too good.", "Correct the record", "Celebrate anyway", "Honest results, honest school.", "The inspectors are on their way."],
  ["C30", "Snowed in", "cloud", "Snow has buried every road out of town.", "Fix the snowplough", "Shovel your own drive", "Roads clear by morning.", "Nobody gets out for a week."],
  ["C31", "Buried treasure", "coins", "A chest of old coins has turned up under the footpath.", "Share it with the town", "Finders keepers", "The town buys a new bandstand.", "One very nice holiday for someone."],
  ["C32", "Bad prawns", "food", "The street party prawns were a mistake.", "Get everyone checked", "Blame the host", "A dodgy prawn, quickly dealt with.", "A feud that will last generations."],
  ["C33", "Funny money", "coins", "Fake notes are going round the shops.", "Pay for an investigation", "Keep spending them", "The forger is caught.", "Nobody trusts a tenner again."],
  ["C34", "A famous face", "burst", "A celebrity offers to open the fete, for a fee.", "Make it free for all", "Sell VIP tickets", "The whole town gets a selfie.", "A velvet rope across the village green."],
  ["C35", "Jobs for the family", "mask", "A plum town job went to the mayor's cousin.", "Reopen the job", "Welcome the new hire", "A fair process, a better hire.", "The cousin starts Monday."],
  ["C36", "No signal", "bolt", "The phone network is down across town.", "Fund the repair", "Write letters", "Signal restored.", "A week of silence and confusion."],
];

export const CARDS: EventCard[] = ROWS.map(([id, title, icon, premise, helpLabel, harmLabel, helpResult, harmResult]) => ({
  id, title, icon, premise, helpLabel, harmLabel, helpResult, harmResult,
}));

export const CARD_BY_ID: Record<string, EventCard> = Object.fromEntries(CARDS.map((c) => [c.id, c]));

import type { Category, EventCard, Profession } from "./types.ts";

// THE DECK: exactly 100 cards. 10 per profession + 20 universal. 60 BAD / 25 GOOD / 15 MORAL.
// In all text, {P} is the primary target and {S} the secondary target (both real players).
// HELP is always the pro-town choice. On scandal cards HELP means accountability.
// Every HARM option has a plausible reason to pick it.

type Row = [
  id: string,
  title: string,
  category: Category,
  premise: string,
  helpLabel: string,
  harmLabel: string,
  helpResult: string,
  harmResult: string,
  template: string,
];

const FARMER: Row[] = [
  ["FAR01", "The Barn Is Burning", "BAD", "A midnight fire threatens {P}'s stores.", "Form a bucket chain", "Let it burn, it's late", "The town drags itself out of bed and saves the barn.", "The barn goes up. Ash lands all over {S}'s washing.", "T01"],
  ["FAR02", "Blight in the Fields", "BAD", "A spreading crop disease threatens {P}'s harvest.", "Fund the spraying", "Let nature decide", "The blight stops at the fence line.", "Half the harvest rots and {S}'s supply dries up.", "T02"],
  ["FAR03", "The Runaway Herd", "BAD", "{P}'s escaped animals have trampled {S}'s garden.", "Round them up together", "Sue the farmer", "Animals home, garden replanted, friendships intact.", "{S} wins damages. {P} pays up.", "T19"],
  ["FAR04", "The Broken Irrigation Pump", "BAD", "{P}'s fields will dry out unless somebody pays for repairs.", "Chip in for repairs", "Let the fields dry", "Water flows. Everyone eats.", "Dry fields, dear vegetables. {S} feels it too.", "T03"],
  ["FAR05", "The Contaminated Well", "BAD", "Water from {P}'s farm well may be unsafe for the whole town.", "Test and treat the well", "Drink up, it's fine", "The well is cleaned before anyone falls ill.", "Half the town spends the week indoors. {P} gets the blame and {S} gets the bill.", "T14"],
  ["FAR06", "The Flooded Orchard", "BAD", "Spring floods threaten {P}'s valuable trees.", "Sandbag the orchard", "They're only apples", "The orchard survives the flood.", "The trees drown. {S} loses their cider supplier.", "T01"],
  ["FAR07", "The Harvest Festival", "GOOD", "{P}'s bumper crop could finance a community festival.", "Throw the festival", "Sell the crop privately", "Bunting, cider and a tug of war {S} still talks about.", "{P} sells to the city at top price. {S}'s stall stays empty.", "T05"],
  ["FAR08", "The Rare Seed", "MORAL", "A valuable seed shipment for {P} arrives with a contract nobody has read.", "Read the small print", "Sign it, quick", "The town spots the catch and negotiates a fair deal.", "{P} profits handsomely. The clause about {S}'s land kicks in next spring.", "T18"],
  ["FAR09", "The Farm Sale", "BAD", "A developer wants to buy {P}'s land, with {S} lined up as the agent.", "Block the sale", "Let the developer in", "The farm stays a farm. Everyone keeps the view.", "Luxury flats go up. {S} pockets the commission.", "T11"],
  ["FAR10", "The Pesticide Secret", "MORAL", "{P} used a dubious chemical to save the crops. {S}'s bees have gone quiet.", "Report it", "Keep it quiet", "{P} is fined, the fields are cleaned and {S}'s hives recover.", "The crops look great. {S}'s bees do not.", "T07"],
];

const DOCTOR: Row[] = [
  ["DOC01", "Clinic Power Outage", "BAD", "{P}'s clinic needs emergency generators.", "Buy the generators", "Wait for the grid", "The lights stay on and so do the patients.", "The clinic shuts for a week. {S} has to drive to the city.", "T01"],
  ["DOC02", "The Missing Medicine", "BAD", "Essential prescriptions have gone missing from {P}'s clinic.", "Launch a search", "Order nothing, save money", "The medicine turns up in the wrong van. Panic over.", "{P} pays for emergency stock out of their own pocket.", "T17"],
  ["DOC03", "The Waiting Room Leak", "BAD", "A leak threatens {P}'s clinic equipment.", "Fix the roof", "Put a bucket under it", "Dry ceiling, working scanner.", "The X-ray machine fizzes. {S}'s appointment is cancelled.", "T02"],
  ["DOC04", "Winter Fever", "BAD", "A sickness is spreading. {P} wants a vaccination drive.", "Fund flu jabs", "Tough it out", "A sore arm each and a healthy winter.", "Half the town is bedbound. {P} and {S} both lose a fortnight.", "T15"],
  ["DOC05", "The Ambulance Breakdown", "BAD", "{P}'s only ambulance is off the road.", "Pay for repairs", "Patients can get a taxi", "Sirens back on the road.", "{P} spends the week driving patients in their own car.", "T09"],
  ["DOC06", "The Expired Supplies", "BAD", "A shipment of {P}'s clinic supplies may be past its date.", "Bin them and restock", "Use them anyway", "Fresh supplies, no surprises.", "Something goes wrong. {P} faces a complaint and {S} faces a rash.", "T14"],
  ["DOC07", "The Visiting Specialist", "GOOD", "A specialist will run free clinics with {P} if the town can house them.", "Host the specialist", "Rent the room to tourists", "Free check-ups for all. {P}'s clinic gets the credit.", "The specialist goes elsewhere. {S} lets the spare room for a tidy sum.", "T04"],
  ["DOC08", "The New Health Grant", "GOOD", "An unexpected medical grant is available for {P}'s clinic.", "Apply together", "Spend it on the roads instead", "The clinic gets its grant.", "The money goes on potholes. {S}'s street is lovely now.", "T06"],
  ["DOC09", "The Wellness Retreat", "GOOD", "A company offers to fund local health services if {P} helps open a 'wellness retreat'.", "Take the funding and share it", "Let the doctor run the retreat", "The clinic is funded and {S} gets free physio.", "{P} becomes the retreat's well-paid medical director. Clinic hours shrink.", "T16"],
  ["DOC10", "The Quiet Misdiagnosis", "MORAL", "A costly mistake by {P} has been covered up. {S} was the patient.", "Own up", "Bury it", "{P} apologises and pays compensation to {S}.", "The file goes missing. {S} never finds out why their bill was so high.", "T08"],
];

const BUILDER: Row[] = [
  ["BUI01", "The Collapsing Bridge", "BAD", "A bridge {P} maintains is about to close.", "Repair the bridge", "Put up a detour sign", "The bridge is saved and traffic flows.", "A forty-minute detour for everyone, including {S}.", "T03"],
  ["BUI02", "Cracks in the Town Hall", "BAD", "Repairs to the town hall cannot wait, and {P} has the contract.", "Shore it up", "Paint over the cracks", "Solid walls, solid reputation.", "The cracks reappear on the front page. {S}'s office is evacuated.", "T12"],
  ["BUI03", "The Leaking Roof", "BAD", "Heavy rain reveals a dangerous roof on {P}'s yard.", "Fix it properly", "Patch it with a tarp", "Watertight and safe.", "The tarp gives way. {S}'s stored furniture is soaked.", "T02"],
  ["BUI04", "The Unsafe Playground", "BAD", "Playground equipment {P} installed has failed inspection.", "Replace the equipment", "Tape it off forever", "New swings, happy kids, no lawsuit.", "The council fines {P} for the eyesore.", "T17"],
  ["BUI05", "The Burst Main", "BAD", "A burst pipe threatens several homes, {P}'s included.", "Dig it up tonight", "Wait for Monday", "Fixed by midnight. Hot baths all round.", "A weekend of flooded kitchens for {P} and {S}.", "T15"],
  ["BUI06", "The Fallen Tree", "BAD", "A tree blocks the emergency road by {P}'s yard.", "Clear the road", "Drive round it", "Chainsaws at dawn. Road open.", "A fire engine can't get through. {P}'s shed and {S}'s fence pay the price.", "T14"],
  ["BUI07", "The New Housing Plot", "GOOD", "An investor will build new homes, but wants {S} running the site instead of {P}.", "Hire local, build together", "Give it to the investor's pick", "{P} builds, {S} supplies, new neighbours move in.", "{S} runs the job. {P} watches from the pub.", "T11"],
  ["BUI08", "The Restoration Prize", "GOOD", "The town could win a renovation grant with {P}'s design.", "Enter as a town", "Let the builder enter alone", "The town wins and shares the prize.", "{P} wins solo and keeps it. {S}'s shopfront stays shabby.", "T05"],
  ["BUI09", "The Beautiful Square", "GOOD", "An artist proposes a new town square, and {P} would build it.", "Fund it properly", "Let the builder cut corners", "A gorgeous square. Coffee tastes better there.", "{P} builds it cheap and pockets the difference. {S} trips on a loose slab.", "T13"],
  ["BUI10", "The Cheap Materials", "MORAL", "{P} has been offered questionable discounted supplies for {S}'s extension.", "Refuse the dodgy supplies", "Use them, nobody will know", "{P} pays full price. {S}'s extension won't fall down.", "{P} saves a fortune. {S}'s ceiling starts to sag.", "T07"],
];

const BANKER: Row[] = [
  ["BAN01", "The Cash Machine Fails", "BAD", "The only cash machine, outside {P}'s bank, stops working.", "Pay for a new machine", "Everyone can drive to town", "Cash flows again.", "Trade dries up. {S}'s cash-only stall has a dead week.", "T02"],
  ["BAN02", "The Missing Payroll", "BAD", "Local wages paid through {P}'s bank have not arrived.", "Cover wages from reserves", "Wages can wait", "Everyone is paid on time and {S} can make rent.", "{P} faces a queue of furious customers and a regulator's letter.", "T09"],
  ["BAN03", "The Bank Server Crash", "BAD", "Digital payments at {P}'s bank are broken.", "Pay for an urgent fix", "Wait for head office", "Cards work again by lunchtime.", "Three days of IOUs. {P} and {S} both lose trade.", "T15"],
  ["BAN04", "The Loan Default", "BAD", "{S}'s business has missed a repayment to {P}'s bank.", "Give them more time", "Call in the debt", "{P} swallows the loss and {S}'s shop survives.", "{P} gets paid. {S} sells the van.", "T20"],
  ["BAN05", "The Counterfeit Notes", "BAD", "Forged notes are circulating through {P}'s bank.", "Pay for an investigation", "Keep spending them", "The forger is caught and the notes are pulled.", "The bank is blamed. {P} is fined and {S} is left holding fakes.", "T14"],
  ["BAN06", "The Security Alarm", "BAD", "A late-night alarm is ringing at {P}'s bank.", "Investigate together", "Ignore it, probably a cat", "It was a break-in. The town scares them off.", "It wasn't a cat. {P}'s vault is lighter and {S}'s deposit box is empty.", "T01"],
  ["BAN07", "The Community Bond", "GOOD", "{P} proposes a bond so residents can finance the new sports hall.", "Buy the bond", "Invest privately instead", "The hall is built and the bond pays out.", "The bond flops. {S}'s private fund does nicely though.", "T04"],
  ["BAN08", "The Surprise Dividend", "MORAL", "An investment {P} managed has produced a surprise windfall.", "Share it with the town", "Let the banker keep it", "Everyone gets a slice, {S} included.", "{P} buys a boat. {S} had paid into that fund.", "T13"],
  ["BAN09", "The Outside Investor", "BAD", "A mysterious investor wants to buy into the town through {P}'s bank.", "Ask where the money's from", "Take it, no questions", "The investor vanishes. The town keeps its dignity.", "{P} earns a fat fee. {S}'s rent mysteriously doubles.", "T18"],
  ["BAN10", "The Insider Deal", "MORAL", "{P} may have profited from private information about {S}'s business.", "Open the books", "Stop asking questions", "{P} is found out and repays {S}.", "Nothing to see here. {P} is up and {S} is down.", "T08"],
];

const TEACHER: Row[] = [
  ["TEA01", "The Classroom Flood", "BAD", "{P}'s school is damaged during a storm.", "Fund the clean-up", "Teach in the hall", "Dry classrooms by Monday.", "Lessons in the hall all term. {P} and {S} both suffer for it.", "T03"],
  ["TEA02", "The Broken School Bus", "BAD", "Children may lose transport to {P}'s lessons.", "Fix the bus", "Kids can walk", "The bus runs and {S}'s kids get a lift.", "Attendance collapses. {P}'s funding is cut.", "T09"],
  ["TEA03", "The Exam Papers Vanish", "BAD", "{P}'s exam papers have gone missing the night before the exam.", "Re-sit with new papers", "Blame the teacher", "New papers, honest results.", "{P} takes the blame. {S} quietly gets the deputy head job.", "T19"],
  ["TEA04", "The Library Closure", "BAD", "{P}'s school library faces sudden closure.", "Save the library", "Turn it into a car park", "The library stays. Reading scores hold.", "A car park. {S} and {P} both lose their reading group.", "T12"],
  ["TEA05", "The Heating Failure", "BAD", "{P}'s school will be too cold to open.", "Replace the boiler", "Wear coats indoors", "Warm classrooms, happy staff.", "Lessons in mittens. {S}'s kids are sent home sick.", "T02"],
  ["TEA06", "The Playground Sinkhole", "BAD", "A sinkhole has appeared beside {P}'s school.", "Fill it in properly", "Put a cone on it", "Solid ground again.", "The cone falls in. {P} faces an inquiry and {S}'s car is stuck.", "T14"],
  ["TEA07", "The Scholarship Fund", "GOOD", "A donor offers to sponsor students at {P}'s school.", "Accept it for the school", "Send it to the private school", "Bright kids get their chance.", "The money goes up the road. {S}'s nephew gets a blazer.", "T06"],
  ["TEA08", "The Science Competition", "GOOD", "{P}'s team could compete nationally if the town funds the trip.", "Fund the team", "Let the teacher sell the project", "The team comes third. {S} drives the minibus proudly.", "{P} sells the project to a gadget company. {S} did the hours for nothing.", "T05"],
  ["TEA09", "The Celebrity Visitor", "MORAL", "A famous guest offers to visit {P}'s school, for a fee and a photo opportunity.", "Make it a free town event", "Sell VIP tickets", "The whole town meets the star. {S} gets a selfie.", "{P} sells front-row seats at a premium.", "T16"],
  ["TEA10", "The Inflated Results", "MORAL", "Someone at {P}'s school may have altered the published results. {S}'s school came second.", "Correct the record", "Celebrate the results", "{P} is embarrassed and {S}'s school gets the credit.", "Champagne at {P}'s school. {S} smells a rat.", "T07"],
];

const MAYOR: Row[] = [
  ["MAY01", "The Emergency Siren", "BAD", "The warning system {P} oversees has failed.", "Replace the siren", "Use a megaphone", "The siren is back and tested.", "A flood warning comes too late for {P} and {S}.", "T03"],
  ["MAY02", "The Public Records Leak", "BAD", "Confidential documents from {P}'s office have escaped.", "Plug the leak", "Blame the mayor", "The leak is sealed and the office tightens up.", "{P} takes the fall. {S} is suddenly in line for the job.", "T19"],
  ["MAY03", "The Council Roof Collapse", "BAD", "{P}'s council chamber is suddenly unusable.", "Rebuild the roof", "Meet in the pub", "The chamber reopens.", "Council business in the pub. {P}'s budget and {S}'s licence both suffer.", "T02"],
  ["MAY04", "The Election Posters", "BAD", "A bitter political row involving {P} is costing the town money.", "Call a truce", "Keep the campaign going", "The row ends and the posters come down.", "More posters, more printing bills for {P} and {S}.", "T12"],
  ["MAY05", "The Broken Streetlights", "BAD", "Whole streets have gone dark on {P}'s watch.", "Fund new bulbs", "Carry torches", "Light returns.", "Dark streets, nervous residents. {P} and {S} both pay for it.", "T15"],
  ["MAY06", "The Missed Waste Collection", "BAD", "Refuse is piling up and {P} is getting the blame.", "Pay for extra collections", "Let it pile up", "Clean streets by Friday.", "Rats. Everywhere. {S}'s doorstep is the worst.", "T03"],
  ["MAY07", "The Tourism Award", "GOOD", "The town is shortlisted for a tourism prize, with {P} fronting the bid.", "Bid as a town", "Let the mayor take the credit", "The town wins and everybody benefits.", "{P} collects the trophy and a speaking fee. {S} isn't mentioned.", "T05"],
  ["MAY08", "The Civic Anniversary", "GOOD", "The anniversary {P} is organising could attract visitors and investment.", "Throw a free party", "Sell the sponsorship", "A street party for the ages.", "{P} sells naming rights to a crisp brand.", "T16"],
  ["MAY09", "The Sister Town Offer", "GOOD", "A nearby town proposes a partnership, but wants to deal with {S}, not {P}.", "Partner as a town", "Let {S} cut a side deal", "A proper partnership. {P} and {S} both gain.", "{S} signs privately and does very well. {P} looks foolish.", "T11"],
  ["MAY10", "The Expense Account", "MORAL", "{P} has charged suspicious dinners to town funds. {S} spotted the receipts.", "Audit the expenses", "Let it slide", "{P} pays it back. {S} is thanked for spotting it.", "{P} keeps dining. {S} is moved to a smaller office.", "T07"],
];

const GROCER: Row[] = [
  ["GRO01", "The Spoiled Freezer", "BAD", "A freezer failure threatens a week of {P}'s food.", "Lend a generator", "Let it thaw", "Frozen peas saved.", "A week of stock in the bin. {S}'s order never comes.", "T01"],
  ["GRO02", "The Missing Delivery", "BAD", "A lorry carrying {P}'s groceries has failed to arrive.", "Organise a supply run", "Wait it out", "Shelves restocked by teatime.", "Empty shelves. {S}'s café runs out of milk.", "T02"],
  ["GRO03", "The Rodent Problem", "BAD", "A pest problem has closed {P}'s shop.", "Call pest control", "Shut it and hope", "Shop reopens and {S} gets their deliveries.", "The shop stays shut. {P} loses a fortnight.", "T09"],
  ["GRO04", "The Broken Shopfront", "BAD", "{P}'s front window has been smashed.", "Help repair it", "Not our window", "New glass, fresh display, {S}'s lending hand remembered.", "Boarded up for weeks. {P} loses trade.", "T10"],
  ["GRO05", "The Empty Shelves", "BAD", "Vital supplies at {P}'s shop are running low.", "Pool orders", "Every household for itself", "The town shops together and nobody goes short.", "Panic buying. {P} and {S} both lose out.", "T15"],
  ["GRO06", "The Spoiled Milk", "BAD", "A refrigeration fault threatens {P}'s fresh stock.", "Recall and replace", "Sell it quick", "Fresh milk, clean conscience.", "Sour milk sold. {P} is reported and {S} is ill.", "T14"],
  ["GRO07", "The Farmers' Market", "GOOD", "A weekly market could boost the high street, run by {S} on {P}'s doorstep.", "Share the pitches", "Hand it all to {S}", "A bustling market. {P} and {S} both do well.", "{S} runs it alone and undercuts {P}.", "T11"],
  ["GRO08", "The Rare Produce Shipment", "GOOD", "An exclusive shipment at {P}'s shop could draw visitors.", "Sell at fair prices", "Sell it at a markup", "Visitors flock in and spend locally.", "{P} makes a killing. {S} can't afford a single truffle.", "T18"],
  ["GRO09", "The Community Pantry", "GOOD", "{P} could partner on a pantry for affordable groceries.", "Open the pantry", "Let the supermarket do it", "Cheap food for everyone and {P} gets the footfall.", "The supermarket moves in. {S} gets a staff discount there.", "T04"],
  ["GRO10", "The Price-Gouging Rumour", "MORAL", "{P} is accused of raising prices during the shortage. {S} kept the receipts.", "Investigate the prices", "Pay up and move on", "{P} refunds the difference and {S} is vindicated.", "{P} keeps the profits. {S} shops elsewhere.", "T08"],
];

const MECHANIC: Row[] = [
  ["MEC01", "The Fire Engine Stall", "BAD", "The fire engine {P} services will not start.", "Fund the repair", "Hope there's no fire", "The engine roars back to life.", "A chip-pan fire goes unanswered. {P} and {S} both pay.", "T03"],
  ["MEC02", "The Garage Blaze", "BAD", "A fire has damaged {P}'s workshop.", "Help rebuild", "Not our garage", "The workshop reopens with new tools. {S} helped and got a free service.", "{P} works out of a tent all winter.", "T10"],
  ["MEC03", "The Faulty Brake Recall", "BAD", "A dangerous batch of parts has gone through {P}'s garage.", "Recall every car", "Keep driving", "Every car is fixed.", "A fender-bender. {P} is sued and {S} needs a new bumper.", "T14"],
  ["MEC04", "The Snowplough Failure", "BAD", "The snowplough {P} maintains has broken down.", "Fix the plough", "Shovel your own road", "Roads clear by morning.", "Snowed in. {P} and {S} both lose a week.", "T15"],
  ["MEC05", "The Bus Engine Dies", "BAD", "A commuter bus {P} services has broken down.", "Pay for a new engine", "Everyone can walk", "The bus runs again.", "No bus. {S} misses three shifts and {P} loses the contract.", "T02"],
  ["MEC06", "The Fuel Shortage", "BAD", "Vehicles may be stranded for days and {P}'s pumps are dry.", "Organise a fuel convoy", "Hoard what's left", "Tanks full by Tuesday.", "{P}'s garage stands idle. {S} is stranded.", "T12"],
  ["MEC07", "The Vintage Car Rally", "GOOD", "A rally could bring visitors into town, if {P} preps the cars.", "Host the rally", "Let the mechanic charge entry", "Chrome, crowds and full cafés.", "{P} charges a fortune at the gate. {S}'s café gets nobody.", "T05"],
  ["MEC08", "The Repair Contract", "GOOD", "An outside fleet offers {P}'s garage a major job.", "Back the local garage", "Give it to the city garage", "The garage thrives and hires locally.", "The city garage gets it. {S} takes a backhander for the introduction.", "T06"],
  ["MEC09", "The Electric Fleet", "GOOD", "A grant could modernise local vehicles through {P}'s garage.", "Modernise the town fleet", "Let the mechanic flip the grant", "Silent buses and cheaper fares. {S} gets a charger.", "{P} buys the cars and sells them on. Nice profit.", "T16"],
  ["MEC10", "The Fake Repair Bill", "MORAL", "{S} suspects {P} billed for work that was never done.", "Investigate the bill", "Pay it, no fuss", "{P} refunds {S}, red-faced.", "{P} keeps the money. {S} keeps the rattle.", "T07"],
];

const UNIVERSAL: Row[] = [
  ["UNI01", "The River Rises", "BAD", "A flood threatens low-lying homes, {P}'s first.", "Sandbag the banks", "Move upstairs", "The water stops at the sandbags.", "{P}'s ground floor is ruined. {S}'s cellar too.", "T01"],
  ["UNI02", "The Storm Warning", "BAD", "A violent storm is coming. {P} wants everyone to board up.", "Prepare together", "Hope it misses", "The storm blows over and the town stands.", "Roofs off. {P} and {S} both pay for repairs.", "T03"],
  ["UNI03", "The Food Poisoning Scare", "BAD", "A meal {P} hosted may have sickened neighbours.", "Get everyone checked", "Blame the host", "A dodgy prawn, quickly dealt with. No harm done.", "{P} is shunned. {S} launches a rival catering business.", "T19"],
  ["UNI04", "The Escaped Animal", "BAD", "An escaped bull is roaming the streets near {P}'s house.", "Catch it together", "Stay indoors", "The bull is home by lunch.", "The bull rearranges {P}'s front garden and {S}'s car.", "T02"],
  ["UNI05", "The Water Main Burst", "BAD", "Water pressure has dropped across town. {P}'s street is worst hit.", "Pay for emergency repairs", "Buy bottled water", "Taps running again.", "A week of bottled water for {P} and {S}.", "T15"],
  ["UNI06", "The Power Cut", "BAD", "Half the town has lost power, including {P}.", "Fund the repair crew", "Light some candles", "The lights come back on.", "A cold, dark week. {P} and {S} both lose out.", "T03"],
  ["UNI07", "The Road Closure", "BAD", "The main road into town has closed beside {P}'s place.", "Clear and reopen it", "Use the back lanes", "Traffic back to normal.", "Trade suffers. {P} and {S} take the hit.", "T12"],
  ["UNI08", "The Missing Town Funds", "BAD", "The town account is short, and {P} was last to see the books.", "Trace the money", "Raise everyone's rates", "A banking error. {P} is cleared.", "Rates go up. {P} is whispered about and {S} pays more.", "T14"],
  ["UNI09", "The Fireworks Accident", "BAD", "A rocket has gone astray at the celebration and {P}'s shed is alight.", "Put it out", "Enjoy the show", "The shed is saved. Fireworks resume.", "The shed is gone. Sparks reach {S}'s hedge.", "T01"],
  ["UNI10", "The Phone Network Fails", "BAD", "Nobody can contact anyone. {P} wants to fund a repair.", "Fund the repair", "Write letters", "Signal restored.", "A week of silence. {P} and {S} both miss out on work.", "T15"],
  ["UNI11", "The Celebrity Film Shoot", "GOOD", "A film crew wants to pay to shoot in town, starting at {P}'s place.", "Share the location fees", "Let {P} keep the fee", "Everyone gets a cut and {S} becomes an extra.", "{P} banks the cheque. {S}'s street is blocked for a week.", "T13"],
  ["UNI12", "The Lottery Windfall", "GOOD", "{P} has won the lottery. The town hopes for a donation to {S}'s youth club.", "Donate to the youth club", "Keep every penny", "A new roof for the youth club. {S} is thrilled.", "{P} keeps it all. The youth club shuts. {S} is livid.", "T20"],
  ["UNI13", "The Visitor Boom", "GOOD", "Unexpected visitors are filling the high street, mostly at {P}'s place.", "Spread them round town", "Let {P} cash in", "Every business gets a boost.", "{P} has the best week of their life.", "T16"],
  ["UNI14", "The Famous Restaurant", "GOOD", "A celebrated chef wants to open locally, in either {P}'s premises or {S}'s.", "Share the business", "Let {S} sign the lease", "A joint venture. Both premises buzz.", "{S} lands the chef. {P} is left with an empty unit.", "T11"],
  ["UNI15", "The Community Festival", "GOOD", "A festival could lift everyone's fortunes, with {P} running it.", "Fund the festival", "Let {P} sell the tickets", "A brilliant weekend for everyone.", "{P} turns it into a paid event. {S} can't afford to go.", "T05"],
  ["UNI16", "The Buried Treasure", "GOOD", "{P} has dug up an old chest of valuables under a public footpath.", "Share it with the town", "Finders keepers", "The treasure funds a new bench and a party.", "{P} keeps it. {S} owned the footpath, technically.", "T13"],
  ["UNI17", "The Secret Recording", "MORAL", "{P} has a private recording that could ruin {S}.", "Delete it", "Play it at the pub", "{P} deletes it. {S} never knows how close it came.", "The pub falls silent. {S} is ruined. {P} gets the gossip column.", "T07"],
  ["UNI18", "The Suspicious Donation", "MORAL", "An anonymous donor offers {P} a suspiciously large gift for the town.", "Check where it came from", "Bank it quietly", "It was dodgy. Returned, with the town's dignity intact.", "{P} takes a 'handling fee'. {S} gets questioned by the police.", "T18"],
  ["UNI19", "The Nepotism Appointment", "MORAL", "{P} gave a coveted town job to a relative instead of {S}.", "Reopen the job", "Welcome the new hire", "A fair process. {S} gets the job.", "{P}'s cousin starts Monday. {S} updates their CV.", "T08"],
  ["UNI20", "The Quiet Land Grab", "MORAL", "{P} is quietly buying up the common land {S} grazes on.", "Protect the common", "Let the sale go through", "The common stays common.", "{P} owns the field. {S} rents it back.", "T07"],
];

const byProf: Record<Profession, Row[]> = {
  FARMER,
  DOCTOR,
  BUILDER,
  BANKER,
  TEACHER,
  MAYOR,
  GROCER,
  MECHANIC,
};

function toCard(row: Row, prof: Profession | null): EventCard {
  const [id, title, category, premise, helpLabel, harmLabel, helpResult, harmResult, template] = row;
  return {
    id,
    title,
    category,
    primaryProfession: prof,
    premise,
    helpLabel,
    harmLabel,
    helpResult,
    harmResult,
    template,
    tags: [category.toLowerCase(), prof ? prof.toLowerCase() : "universal"],
    contentVersion: 1,
  };
}

export const CARDS: EventCard[] = [
  ...(Object.entries(byProf) as [Profession, Row[]][]).flatMap(([prof, rows]) =>
    rows.map((r) => toCard(r, prof)),
  ),
  ...UNIVERSAL.map((r) => toCard(r, null)),
];

export const CARD_BY_ID: Record<string, EventCard> = Object.fromEntries(CARDS.map((c) => [c.id, c]));

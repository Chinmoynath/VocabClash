export interface IdiomEntry {
  idiom: string;
  meaning: string;
  hindi: string;
  example: string;
  origin: string;
  repeats: number;
  distractors: string[];
}

export const IDIOM_MASTER_EXTENDED: IdiomEntry[] = [
  {
    idiom: 'Bite the bullet',
    meaning: 'To face a painful or difficult situation with courage and fortitude',
    hindi: 'हिम्मत से कठिन परिस्थिति का सामना करना',
    example: 'He decided to bite the bullet and invest all his savings into his new business venture.',
    origin: 'Old military surgery practice where wounded soldiers bit lead bullets during amputations.',
    repeats: 22,
    distractors: [
      'To act impulsively without thinking',
      'To surrender cowardly to enemies',
      'To shoot directly at an enemy target'
    ],
  },
  {
    idiom: 'Burn the midnight oil',
    meaning: 'To work or study late into the night',
    hindi: 'देर रात तक कड़ी मेहनत या पढ़ाई करना',
    example: 'Aspirants often burn the midnight oil solving quantitative aptitude and vocabulary mocks.',
    origin: 'Studying by oil lamp illumination before electric light was invented.',
    repeats: 24,
    distractors: [
      'To waste valuable domestic fuel',
      'To wake up early at sunrise',
      'To burn down an old building'
    ],
  },
  {
    idiom: 'Once in a blue moon',
    meaning: 'Very rarely; almost never',
    hindi: 'ईद का चाँद होना / कभी-कभार ही होना',
    example: 'He visits his ancestral village in Bihar once in a blue moon due to his busy corporate job.',
    origin: 'A rare celestial occurrence of a second full moon within a single calendar month.',
    repeats: 26,
    distractors: [
      'Happening on every full moon night',
      'Occurring on a predictable weekly schedule',
      'Something that causes great bad luck'
    ],
  },
  {
    idiom: 'Spill the beans',
    meaning: 'To disclose a secret prematurely or inadvertently',
    hindi: 'रहस्य उजागर करना / भेद खोल देना',
    example: 'Trust him with classified files; he never spills the beans to reporters.',
    origin: 'Ancient Greek voting system with black and white beans placed into an urn.',
    repeats: 21,
    distractors: [
      'To drop grocery items on the kitchen floor',
      'To plant seeds in an agricultural field',
      'To cook a spicy dinner dish'
    ],
  },
  {
    idiom: 'A blessing in disguise',
    meaning: 'An apparent misfortune that eventually results in something good',
    hindi: 'छुपा हुआ वरदान / विपत्ति में छिपा लाभ',
    example: 'Losing that private job was a blessing in disguise as it motivated him to clear SSC CGL.',
    origin: '18th-century English hymn by James Hervey on divine providence.',
    repeats: 23,
    distractors: [
      'A religious prayer offered in a mask',
      'A sudden unexpected disaster',
      'A hidden weapon used by soldiers'
    ],
  },
  {
    idiom: 'Cost an arm and a leg',
    meaning: 'To be extremely expensive',
    hindi: 'बहुत महंगा होना',
    example: 'Specialized cardiac surgery in private hospitals can cost an arm and a leg without health insurance.',
    origin: 'Post-war portraits where portraits showing arms and legs cost significantly more.',
    repeats: 20,
    distractors: [
      'To cause severe physical bodily injury',
      'To be available at a huge discounted clearance price',
      'To require medical surgery for joints'
    ],
  },
  {
    idiom: 'Barking up the wrong tree',
    meaning: 'Pursuing a mistaken line of thought or accusing the wrong person',
    hindi: 'गलत दिशा में प्रयास करना / गलत व्यक्ति पर शक करना',
    example: 'If you think Rajesh leaked the exam questions, you are barking up the wrong tree.',
    origin: 'Hunting dogs barking at the bottom of a tree where a raccoon had already escaped.',
    repeats: 19,
    distractors: [
      'A noisy street dog disturbing neighbors',
      'Climbing tall fruit trees in a garden',
      'Planting saplings in infertile soil'
    ],
  },
  {
    idiom: 'Beat around the bush',
    meaning: 'To avoid talking directly about what is important; delay coming to the point',
    hindi: 'घुमा-फिरा कर बात करना / मुख्य मुद्दे पर न आना',
    example: 'Stop beating around the bush and tell me the exact marks you scored in Tier-1.',
    origin: 'Hunting practice of beating surrounding bushes to flush birds into nets.',
    repeats: 25,
    distractors: [
      'To prune ornamental hedge bushes',
      'To physically hit an intruder with a stick',
      'To get lost inside a dense forest'
    ],
  },
  {
    idiom: 'Leave no stone unturned',
    meaning: 'To try every possible course of action in order to achieve something',
    hindi: 'कोई कसर न छोड़ना / हर संभव प्रयास करना',
    example: 'The CBI team left no stone unturned to locate the absconding bank scam fugitive.',
    origin: 'Ancient Greek myth of Polycrates seeking hidden Persian treasure beneath beach stones.',
    repeats: 27,
    distractors: [
      'To collect mineral stones from a riverbed',
      'To construct a stone monument on a road',
      'To vandalize ancient archaeological ruins'
    ],
  },
  {
    idiom: 'Hit the nail on the head',
    meaning: 'To state or describe a situation with exact precision and truth',
    hindi: 'सटीक बात कहना / सही निष्कर्ष पर पहुँचना',
    example: 'The economics analyst hit the nail on the head when explaining the root cause of rural inflation.',
    origin: 'Carpentry term where striking the nail precisely on center drives it smoothly.',
    repeats: 22,
    distractors: [
      'To accidentally injure fingers with a hammer',
      'To build wooden furniture without nails',
      'To get angry and break household tools'
    ],
  },
  {
    idiom: 'At the eleventh hour',
    meaning: 'At the very last minute or moment before it is too late',
    hindi: 'अंतिम समय में / ठीक ऐन मौके पर',
    example: 'The candidate submitted his online exam registration form at the eleventh hour.',
    origin: 'Biblical parable of laborers hired at the eleventh hour of a twelve-hour workday.',
    repeats: 20,
    distractors: [
      'Exactly at 11:00 PM at night',
      'Well ahead of an official deadline',
      'During a scheduled power outage'
    ],
  },
  {
    idiom: 'Through thick and thin',
    meaning: 'Under all circumstances, no matter how difficult or challenging',
    hindi: 'सुख-दुख में / हर परिस्थिति में साथ देना',
    example: 'Her parents supported her study ambitions through thick and thin until she became an Income Tax Inspector.',
    origin: 'Traveling through thick overgrown forest thickets and thin open clearings.',
    repeats: 19,
    distractors: [
      'Losing and gaining physical body weight',
      'Cooking thick soups and thin porridge',
      'Reading heavy textbooks and thin pamphlets'
    ],
  },
  {
    idiom: 'Piece of cake',
    meaning: 'Something that is very easy to accomplish or solve',
    hindi: 'बच्चों का खेल / अत्यंत सरल कार्य',
    example: 'With six months of daily vocabulary revision, the Tier-1 English section was a piece of cake.',
    origin: '19th-century cake-walk competition where delicious cake was awarded for easy tasks.',
    repeats: 21,
    distractors: [
      'A sweet dessert served at birthday parties',
      'A dangerous assignment given to recruits',
      'A difficult mathematical geometry theorem'
    ],
  },
  {
    idiom: 'Under the weather',
    meaning: 'Feeling slightly unwell, tired, or sick',
    hindi: 'तबीयत ठीक न होना / अस्वस्थ महसूस करना',
    example: 'He couldn\'t attend the morning live mock test because he was feeling a bit under the weather.',
    origin: 'Sailors going below deck during stormy rough weather to avoid seasickness.',
    repeats: 20,
    distractors: [
      'Standing under heavy monsoon rainfall without an umbrella',
      'Predicting tomorrow\'s atmospheric temperature',
      'Enjoying a sunny picnic in a hill station'
    ],
  },
  {
    idiom: 'Break a leg',
    meaning: 'Good luck! (Said especially to performers before a stage show or exam)',
    hindi: 'शुभकामनाएं! / अच्छा प्रदर्शन करना',
    example: 'As he entered the interview board room, his mentor smiled and whispered, "Break a leg!"',
    origin: 'Theatrical superstition that wishing direct good luck causes bad fortune.',
    repeats: 18,
    distractors: [
      'To fracture a limb in a motorcycle accident',
      'To run very fast in an athletic race',
      'To intentionally trip a competitor'
    ],
  },
  {
    idiom: 'The ball is in your court',
    meaning: 'It is now your decision or responsibility to take the next action',
    hindi: 'अब फैसला आपके हाथ में है',
    example: 'The employer offered a handsome revision in salary; now the ball is in your court.',
    origin: 'Tennis game where the ball is on a player\'s court side and they must return the shot.',
    repeats: 17,
    distractors: [
      'Playing a professional tennis championship',
      'Fighting a legal lawsuit in a civil courtroom',
      'Losing a sports match by one point'
    ],
  },
  {
    idiom: 'Midas touch',
    meaning: 'The ability to make a lot of money easily, or be successful at anything one undertakes',
    hindi: 'जिस काम में हाथ लगाएं उसमें सफलता पाना / पारस का स्पर्श',
    example: 'Every startup he invested in became a billion-dollar unicorn; he truly possesses the Midas touch.',
    origin: 'Greek legend of King Midas, whose touch turned everything into solid gold.',
    repeats: 19,
    distractors: [
      'A healing medicinal touch',
      'The ability to predict market crashes',
      'A tendency to ruin everything one touches'
    ],
  },
  {
    idiom: 'Be hard up',
    meaning: 'To have very little money; experiencing severe financial difficulty or shortage of funds',
    hindi: 'अत्यधिक आर्थिक तंगी में होना / पैसे की भारी किल्लत होना / कंगाली की स्थिति',
    example: 'After the unexpected economic downturn, the startup founder found himself hard up and had to seek emergency loans.',
    origin: 'Nautical term describing a ship\'s helm turned all the way (hard up) against the wind in severe storm distress.',
    repeats: 25,
    distractors: [
      'Find it very difficult to wake up early',
      'Unable to calculate numerical data',
      'Have difficulty in climbing stairs'
    ],
  },
  {
    idiom: 'Hard up',
    meaning: 'Having very little money; in financial need or distress',
    hindi: 'आर्थिक तंगी में / पैसे की कमी से जूझना',
    example: 'He was so hard up that he could scarcely afford two square meals a day.',
    origin: 'Old 19th-century British slang for extreme poverty and financial destitution.',
    repeats: 22,
    distractors: [
      'Physically exhausted from manual labor',
      'Living in a high-rise building',
      'Having strong social connections'
    ],
  },
  {
    idiom: 'At the eleventh hour',
    meaning: 'At the very last possible moment; almost too late',
    hindi: 'अंतिम क्षण में / बिल्कुल आखिरी वक्त पर',
    example: 'The government rolled back the controversial policy at the eleventh hour following widespread protests.',
    origin: 'Biblical parable of laborers hired at the eleventh hour of a twelve-hour workday.',
    repeats: 28,
    distractors: [
      'Exactly at 11 o\'clock at night',
      'Early in the morning during dawn',
      'After an unacceptably long delay'
    ],
  },
  {
    idiom: 'Under the weather',
    meaning: 'Feeling slightly unwell, sick, or indisposed',
    hindi: 'तबीयत खराब होना / अस्वस्थ महसूस करना',
    example: 'She could not attend the general awareness lecture as she was feeling a bit under the weather.',
    origin: 'Maritime tradition where sick sailors went below deck to escape bad weather on open seas.',
    repeats: 27,
    distractors: [
      'Caught outside in torrential rain',
      'Suffering from acute depression',
      'Travelling to an unfamiliar climate'
    ],
  },
  {
    idiom: 'A blessing in disguise',
    meaning: 'An apparent misfortune that eventually results in something unexpectedly good',
    hindi: 'छुपा हुआ वरदान / दुख के वेश में सुख',
    example: 'Failing the prelims in his first attempt was a blessing in disguise as it taught him disciplined time management.',
    origin: '18th-century poetic expression regarding divine providence disguised as trials.',
    repeats: 24,
    distractors: [
      'A curse delivered by a holy person',
      'A miraculous discovery in nature',
      'A fraudulent gift from a stranger'
    ],
  },
];


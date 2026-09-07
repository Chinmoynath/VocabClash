import { Question, QuestionCategory } from '../types';
import { ALL_VOCAB_MASTER } from '../services/questionBankEngine';
import { OWS_MASTER_EXTENDED } from '../data/owsMasterData';
import { IDIOM_MASTER_EXTENDED } from '../data/idiomMasterData';

export interface QuestionMeaningsBreakdown {
  targetWord: string;
  targetMeaning: string;
  targetHindi: string;
  targetLabel?: string;
  correctOption?: string;
  correctMeaning?: string;
  correctHindi?: string;
  categoryLabel?: string;
  combinedEnglishText: string;
  combinedHindiText: string;
}

export interface CardEducation {
  meaning: string;
  hindiMeaning: string;
  mnemonic: string;
  exampleSentence: string;
  rootWordInfo?: string;
  meaningsBreakdown: QuestionMeaningsBreakdown;
}

interface VocabMasterRecord {
  hindi: string;
  english: string;
  mnemonic: string;
  example?: string;
  root?: string;
}

/**
 * Ultra-rich dictionary of high-yield PYQ exam words, synonyms, antonyms, and terms
 * tested in SSC CGL, CHSL, CPO, MTS, CDS, NDA, and Banking exams.
 */
export const HIGH_YIELD_EXAM_VOCAB: Record<string, VocabMasterRecord> = {
  // RENOUNCE & ALLIED SYNONYMS (Abjure, Relinquish, Abdicate, Forswear, etc.)
  'renounce': {
    hindi: 'त्यागना / परित्याग करना / छोड़ देना',
    english: 'Formally declare one’s abandonment of a claim, right, or belief; give up.',
    mnemonic: 'Re + Announce: Sabke samne announce karke post ya claim renounce (tyagna) kar diya.',
    example: 'He decided to renounce all political ambitions and lead a quiet life.',
    root: 'Latin renuntiare ("to declare against, protest, disclaim").',
  },
  'abjure': {
    hindi: 'शपथपूर्वक त्यागना / मुकरना',
    english: 'Solemnly renounce or abandon a belief, cause, or claim.',
    mnemonic: 'Ab + Jure (Jury): Jury ke samne khade hokar apni galat affiliation abjure (tyag) kar di.',
    example: 'The reformed rebel promised to abjure violence and respect the law.',
    root: 'Latin abjurare from ab- ("away") + jurare ("to swear").',
  },
  'relinquish': {
    hindi: 'स्वेच्छा से त्यागना / छोड़ देना',
    english: 'Voluntarily cease to keep or claim; surrender or give up.',
    mnemonic: 'Re + Linquish: Apni purani wish ka link chhod dena / relinquish kar dena.',
    example: 'He had to relinquish control of the enterprise due to poor health.',
    root: 'Latin relinquere ("to leave behind").',
  },
  'abdicate': {
    hindi: 'पद या सिंहासन त्यागना',
    english: 'Renounce one’s throne or high office; fail to fulfill a duty.',
    mnemonic: 'Ab + Dicate (Dictate): Ab wo dictate nahi kar sakta kyunki usne throne abdicate kar diya.',
    example: 'King Edward VIII chose to abdicate the throne in 1936 to marry the woman he loved.',
    root: 'Latin abdicare ("to proclaim away, disown").',
  },
  'forswear': {
    hindi: 'कसम खाकर छोड़ना / त्याग देना',
    english: 'Agree to give up or do without (something) formally or solemnly.',
    mnemonic: 'For + Swear: Swear karke kisi galat aadat ko forswear kar dena.',
    example: 'He resolved to forswear cigarettes and alcohol on New Year’s Day.',
  },
  'repudiate': {
    hindi: 'अस्वीकार करना / संबंध तोड़ना',
    english: 'Refuse to accept or be associated with; deny the truth or validity of.',
    mnemonic: 'Re + Pudiate (Refuse duty): Apne purane vaadon ko repudiate kar dena.',
    example: 'The ministry was quick to repudiate the unfounded corruption allegations.',
    root: 'Latin repudiare ("to divorce, reject").',
  },
  'recant': {
    hindi: 'बयान वापस लेना / बात से पलटना',
    english: 'Say that one no longer holds an opinion, statement, or belief.',
    mnemonic: 'Re + Cant (Chant): Pehle jo chant kiya tha, ab use recant (wapas) le liya.',
    example: 'Galileo was forced by the Inquisition to recant his astronomical discoveries.',
    root: 'Latin recantare from re- ("back") + cantare ("to sing/chant").',
  },
  'disavow': {
    hindi: 'मुकरना / अस्वीकार करना',
    english: 'Deny any responsibility or support for something; disown.',
    mnemonic: 'Dis + Avow: Avow (pledge) ko todna -> Disavow any connection.',
    example: 'The company issued an official circular to disavow the fraudulent emails.',
  },
  'apostate': {
    hindi: 'स्वधर्मत्यागी / धर्मभ्रष्ट / दल बदलू',
    english: 'A person who renounces or abandons a religious or political belief.',
    mnemonic: 'A-Post-State: Apna purana post aur state of faith chhodne wala.',
    example: 'He was branded an apostate by party veterans after switching allegiances.',
    root: 'Greek apostates ("runaway, deserter").',
  },

  // HIGH-YIELD A-Z VOCABULARY FREQUENTLY TESTED IN SSC/CGL/CHSL
  'astonished': {
    hindi: 'हैरान / चकित / विस्मित',
    english: 'Very surprised, amazed, or filled with sudden wonder.',
    mnemonic: 'Astonished → so surprised that you feel stunned.',
    example: 'I was astonished to know the truth about what had happened.',
    root: 'Old French estoner ("to stun, daze").',
  },
  'stunned': {
    hindi: 'स्तब्ध / भौंचक्का / अवाक',
    english: 'Extremely shocked or surprised.',
    mnemonic: 'Stun gun impact = totally stunned and overwhelmed.',
    example: 'The unexpected revelation left everyone completely stunned.',
    root: 'Middle English stonen ("to daze, shock").',
  },
  'succumb': {
    hindi: 'हार मान लेना / झुक जाना / दम तोड़ देना',
    english: 'To give in, yield, or fail to resist pressure or temptation.',
    mnemonic: 'Succumb = surrender and give in to pressure.',
    example: 'Despite the immense adversity, the team refused to succumb.',
    root: 'Latin succumbere ("to sink down, yield").',
  },
  'refuse': {
    hindi: 'इंकार करना / अस्वीकार करना / मना करना',
    english: 'To decline, reject, or not agree to something.',
    mnemonic: 'Refuse = resist and say no; the direct antonym of succumb.',
    example: 'She chose to refuse the unethical offer with absolute conviction.',
    root: 'Latin recusare / refundere ("to turn back, reject").',
  },
  'respectful': {
    hindi: 'आदरणीय / सम्मानपूर्ण / विनम्र',
    english: 'Feeling or showing deference, polite regard, and respect for others.',
    mnemonic: 'Respect + Ful: Full of deep regard and courtesy towards elders.',
    example: 'He gave a respectful bow to the committee members.',
    root: 'Latin respectus ("act of looking back, regard").',
  },
  'dutiful': {
    hindi: 'कर्तव्यनिष्ठ / आज्ञाकारी / निष्ठावान',
    english: 'Conscientiously fulfilling one’s duty or obligations; obedient and devoted.',
    mnemonic: 'Duty + Ful: Jo apni duty aur obligations ko full honesty ke sath nibhaye.',
    example: 'A dutiful civil servant working tirelessly for public welfare.',
    root: 'Anglo-Norman duetee ("obligation, duty").',
  },
  'derogatory': {
    hindi: 'अपमानजनक / निंदात्मक / अनादरपूर्ण',
    english: 'Showing a critical or disrespectful attitude; disparaging and belittling.',
    mnemonic: 'De-rogate: Kisi ke samman ko ghatana ya derogatory remarks pass karna.',
    example: 'He apologized for making derogatory remarks during the heated debate.',
    root: 'Latin derogare ("to detract from, repeal partly").',
  },
  'insolent': {
    hindi: 'ढीठ / असभ्य / गुस्ताख़ / उद्दंड',
    english: 'Showing a rude and arrogant lack of respect towards others.',
    mnemonic: 'In (not) + Solent: Jo adab se silent na rahe aur arrogant ban jaye.',
    example: 'The insolent student was reprimanded for talking back to the teacher.',
    root: 'Latin insolens ("unaccustomed, immoderate, arrogant").',
  },
  'admiring': {
    hindi: 'प्रशंसक / आदरयुक्त / सराहना करने वाला',
    english: 'Regarding someone or something with respect or warm approval.',
    mnemonic: 'Admire: Jo kisi ke guno ki prashansa (admiration) kare.',
    example: 'The young artist attracted an admiring audience at the exhibition.',
  },
  'aberration': {
    hindi: 'विपथन / सामान्य से विचलन',
    english: 'A departure from what is normal, usual, or expected.',
    mnemonic: 'Ab + Ration: Ration distribution me deviation (aberration) aana.',
    example: 'The sudden dip in quarterly revenue was deemed a temporary aberration.',
    root: 'Latin aberrare ("to wander away").',
  },
  'accolade': {
    hindi: 'पुरस्कार / सम्मान / प्रशंसा',
    english: 'An award or privilege granted as a special honor or as an acknowledgment of merit.',
    mnemonic: 'A + Cola + De: Great performance ke baad celebration me accolade mila.',
    example: 'The scientist received the highest national accolade for her breakthrough research.',
  },
  'acerbic': {
    hindi: 'कटु / तीखा / कड़वा',
    english: 'Sharp and forthright in tone; tasting sour or bitter.',
    mnemonic: 'Acidic nature = Acerbic tone (cutting and sharp words).',
    example: 'The opposition leader launched an acerbic attack on the proposed fiscal bill.',
  },
  'adroit': {
    hindi: 'निपुण / चतुर / कुशल',
    english: 'Clever or skillful in using the hands or mind.',
    mnemonic: 'Android jaise smart aur dexterous = Adroit.',
    example: 'She proved to be an adroit negotiator during high-stakes diplomatic summits.',
    root: 'French à droit ("according to right, skillfully").',
  },
  'alacrity': {
    hindi: 'तत्परता / उत्साह / फुर्ती',
    english: 'Brisk and cheerful readiness to do something.',
    mnemonic: 'Alert City -> Alacrity (ready and eager to act).',
    example: 'The soldiers accepted the rescue mission with commendable alacrity.',
    root: 'Latin alacritas from alacer ("lively, brisk").',
  },
  'altruistic': {
    hindi: 'परोपकारी / निःस्वार्थ',
    english: 'Showing a disinterested and selfless concern for the well-being of others.',
    mnemonic: 'All + True: Sabka bhala chahne wala person is Altruistic.',
    example: 'His altruistic donations helped build schools across impoverished regions.',
  },
  'ameliorate': {
    hindi: 'सुधारना / बेहतर बनाना',
    english: 'Make (something bad or unsatisfactory) better; improve.',
    mnemonic: 'Amul + Rate: Amul milk ka rate kam karke gareebon ki halat ameliorate ki.',
    example: 'Steps were taken by the civic agency to ameliorate traffic congestion.',
    root: 'Latin melior ("better").',
  },
  'anachronism': {
    hindi: 'काल-दोष / कालभ्रम',
    english: 'A thing belonging or appropriate to a period other than that in which it exists.',
    mnemonic: 'Ana (Against) + Chron (Time) = Out of its proper time period.',
    example: 'Showing a wristwatch in a movie set in ancient Rome was a glaring anachronism.',
  },
  'antipathy': {
    hindi: 'घृणा / तीव्र अनिच्छा',
    english: 'A deep-seated feeling of dislike or aversion.',
    mnemonic: 'Anti + Sympathy = Nafrat / Strong dislike.',
    example: 'There was historic antipathy between the two rival trading communities.',
  },
  'audacious': {
    hindi: 'साहसी / दुस्साहसी / ढीठ',
    english: 'Showing a willingness to take surprisingly bold risks; impudent.',
    mnemonic: 'Audi car chalane wala audacious (bold/reckless) driver.',
    example: 'The commandos executed an audacious midnight rescue behind enemy lines.',
  },
  'austere': {
    hindi: 'कठोर / सादा / संयमी',
    english: 'Severe or strict in manner, attitude, or appearance; having no comforts or luxuries.',
    mnemonic: 'Aus + Tear: Hard living conditions that bring tears = Austere monk life.',
    example: 'The monks lived an austere life devoted entirely to study and contemplation.',
  },
  'banal': {
    hindi: 'मामूली / घिसा-पिटा / साधारण',
    english: 'So lacking in originality as to be obvious and boring; hackneyed.',
    mnemonic: 'Bana-banaya dialogue = Banal and boring.',
    example: 'The film’s plot was criticized as predictable and banal.',
  },
  'belligerent': {
    hindi: 'लड़ाकू / युद्धरत',
    english: 'Hostile and aggressive; engaged in war or conflict.',
    mnemonic: 'Billi (cat) fight karti hai -> Belligerent attitude.',
    example: 'The belligerent stance of the neighboring country raised cross-border tensions.',
    root: 'Latin bellum ("war") + gerere ("to wage").',
  },
  'benevolent': {
    hindi: 'परोपकारी / दयालु',
    english: 'Well meaning and kindly; serving a charitable rather than a profit-making purpose.',
    mnemonic: 'Bene (Good) + Vol (Wish) = Wishing well for everyone.',
    example: 'The benevolent benefactor donated a large sum to fund rural healthcare.',
  },
  'bolster': {
    hindi: 'मजबूत करना / सहारा देना',
    english: 'Support or strengthen; prop up.',
    mnemonic: 'Bolster pillow helps support your back -> Bolster = support/strengthen.',
    example: 'The central bank took proactive steps to bolster foreign exchange reserves.',
  },
  'bombastic': {
    hindi: 'शब्दाडंबरपूर्ण / दिखावटी',
    english: 'High-sounding but with little meaning; inflated; pretentious.',
    mnemonic: 'Bomb-jaise phatne wale speech words with zero real substance.',
    example: 'The candidate’s bombastic rhetoric failed to impress discerning voters.',
  },
  'cacophony': {
    hindi: 'कर्कश ध्वनि / कोलाहल',
    english: 'A harsh, discordant mixture of sounds.',
    mnemonic: 'Caw-caw of crows = Cacophony (harsh noise).',
    example: 'A cacophony of blaring horns filled the busy junction during peak rush hour.',
    root: 'Greek kakos ("bad") + phone ("voice, sound").',
  },
  'cajole': {
    hindi: 'चापलूसी से मनाना / फुसलाना',
    english: 'Persuade someone to do something by sustained coaxing or flattery.',
    mnemonic: 'Kajol ko film ke liye cajole (coax/flatter) kiya.',
    example: 'He managed to cajole his colleagues into working over the weekend.',
  },
  'capricious': {
    hindi: 'मनमौजी / चंचल / अप्रत्याशित',
    english: 'Given to sudden and unaccountable changes of mood or behavior; fickle.',
    mnemonic: 'Cap-price: Market me cap ka price unpredictably badalta rehta hai.',
    example: 'Mountain weather is notoriously capricious, changing from clear skies to storms rapidly.',
  },
  'castigate': {
    hindi: 'कड़ी फटकार लगाना / दंडित करना',
    english: 'Reprimand someone severely; chastise.',
    mnemonic: 'Cast + Gate: Gate par khade karke kadi daant lagana.',
    example: 'The apex court castigated civic authorities for neglecting public hygiene.',
    root: 'Latin castigare ("to punish, correct").',
  },
  'chicanery': {
    hindi: 'धोखाधड़ी / छल-कपट',
    english: 'The use of trickery to achieve a political, financial, or legal purpose.',
    mnemonic: 'Shikari jaise trap lagana = Chicanery.',
    example: 'The auditor uncovered instances of corporate chicanery in the balance sheet.',
  },
  'clandestine': {
    hindi: 'गुप्त / गुप्त रूप से किया गया',
    english: 'Kept secret or done secretively, especially because illicit.',
    mnemonic: 'Clan + Destiny: Secret meetings held in the dead of night.',
    example: 'The intelligence bureau intercepted clandestine weapons shipments.',
  },
  'cogent': {
    hindi: 'ठोस / प्रभावशाली / तर्कसंगत',
    english: 'Clear, logical, and convincing in argument.',
    mnemonic: 'Co-agent ne convincing aur logical argument pesh kiya.',
    example: 'The defense attorney presented a cogent case that secured an acquittal.',
  },
  'connoisseur': {
    hindi: 'पारखी / कला का मर्मज्ञ',
    english: 'An expert judge in matters of taste and fine art.',
    mnemonic: 'Connoisseur recognises genuine art with fine precision.',
    example: 'A true connoisseur of Hindustani classical music easily spots subtle raag nuances.',
    root: 'French connaître ("to know").',
  },
  'contentious': {
    hindi: 'विवादास्पद / झगड़ालू',
    english: 'Causing or likely to cause an argument; controversial.',
    mnemonic: 'Content full of controversy -> Contentious debate.',
    example: 'Land acquisition remains one of the most contentious socio-economic issues.',
  },
  'contrite': {
    hindi: 'पछतावा करने वाला / पश्चातापी',
    english: 'Feeling or expressing remorse at the recognition that one has done wrong.',
    mnemonic: 'Can’t right the wrong, so feeling contrite (remorseful).',
    example: 'The young offender appeared genuinely contrite before the magistrate.',
  },
  'conundrum': {
    hindi: 'पहेली / कठिन समस्या',
    english: 'A confusing and difficult problem or question; a dilemma.',
    mnemonic: 'Kaun-dram: Riddle jiska answer samajh na aaye.',
    example: 'Balancing economic growth with carbon emission limits is a modern conundrum.',
  },
  'craven': {
    hindi: 'कायर / डरपोक',
    english: 'Contemptibly lacking in courage; cowardly.',
    mnemonic: 'Craven sounds like Raven running away in fear.',
    example: 'The captain’s craven desertion of his crew was condemned worldwide.',
  },
  'credulous': {
    hindi: 'भोला-भाला / आसानी से विश्वास करने वाला',
    english: 'Having or showing too great a readiness to believe things; gullible.',
    mnemonic: 'Credit card de de bina soche -> Credulous person.',
    example: 'Credulous investors lost their savings in a fraudulent Ponzi scheme.',
    root: 'Latin credere ("to believe").',
  },
  'equanimity': {
    hindi: 'मानसिक शांति / धैर्य / समभाव',
    english: 'Mental calmness, composure, and evenness of temper, especially in a difficult situation.',
    mnemonic: 'EQUA = equal. An equal, balanced mind = equanimity. Agitation is the opposite.',
    example: 'She accepted both victory and defeat with unwavering equanimity.',
    root: 'Latin aequus ("equal") + animus ("mind").',
  },
  'agitation': {
    hindi: 'बेचैनी / उत्तेजना / अशांति',
    english: 'A state of anxiety, nervous excitement, or emotional disturbance.',
    mnemonic: 'Agitate = stirring up restless disturbance; opposite of calm equanimity.',
    example: 'His visible agitation betrayed his anxiety before the results were announced.',
  },
  'fertile': {
    hindi: 'उपजाऊ / फलदायी / उर्वर',
    english: 'Capable of producing abundant vegetation or fruitful crops.',
    mnemonic: 'Fertile land is productive land.',
    example: 'The fertile river valleys yielded bumper harvests year after year.',
  },
  'productive': {
    hindi: 'उत्पादक / फलदायी / उपयोगी',
    english: 'Producing useful or successful results; yielding high output.',
    mnemonic: 'Produce + Active = producing useful and successful results.',
    example: 'A productive revision session helps retain exam concepts effortlessly.',
  },
  'careless': {
    hindi: 'लापरवाह / बेपरवाह / असावधान',
    english: 'Not giving sufficient attention or thought to avoiding harm or errors.',
    mnemonic: 'Care + Less = without care or attention.',
    example: 'A careless mistake on the answer sheet can cost valuable marks.',
  },
  'dearth': {
    hindi: 'कमी / अभाव / अकाल',
    english: 'A scarcity or lack of something.',
    mnemonic: 'Dearth = Dear Earth par water ki scarcity/kami.',
    example: 'There was a severe dearth of skilled medical personnel in remote clinics.',
  },
  'debacle': {
    hindi: 'विनाश / असफलता / भारी पतन',
    english: 'A sudden and ignominious failure; a fiasco.',
    mnemonic: 'The-buckle broke, leading to complete collapse/debacle.',
    example: 'The military campaign ended in a total debacle with heavy casualties.',
  },
  'deferential': {
    hindi: 'सम्मानपूर्ण / आदरणीय',
    english: 'Showing respectful submission and courteous regard.',
    mnemonic: 'Difference respect karne wala = Deferential attitude.',
    example: 'The junior civil servants were polite and deferential toward the senior secretary.',
  },
  'deleterious': {
    hindi: 'हानिकारक / नुकसानदेह',
    english: 'Causing harm or damage; injurious to health.',
    mnemonic: 'Delete kar do jo harmful hai -> Deleterious effects.',
    example: 'Prolonged exposure to fine particulate matter has deleterious health effects.',
  },
  'deride': {
    hindi: 'उपहास करना / खिल्ली उड़ाना',
    english: 'Express contempt for; ridicule or mock.',
    mnemonic: 'De + Ride: Ride karte huye dost ka mazak udana.',
    example: 'Critics derided the initial blueprint as overly naive and impractical.',
  },
  'diatribe': {
    hindi: 'कटु निंदा / आक्षेपपूर्ण भाषण',
    english: 'A forceful and bitter verbal attack against someone or something.',
    mnemonic: 'Dia + Tribe: Angry verbal attack targeting a group.',
    example: 'The columnist launched a fiery diatribe against government expenditure.',
  },
  'diffident': {
    hindi: 'संकोची / आत्म-संदेही',
    english: 'Modest or shy because of a lack of self-confidence.',
    mnemonic: 'Difficult to be confident -> Diffident.',
    example: 'Despite her brilliance, she remained diffident when presenting before large crowds.',
  },
  'disparage': {
    hindi: 'नीचा दिखाना / अवमूल्यन करना',
    english: 'Regard or represent as being of little worth; belittle.',
    mnemonic: 'Dis-praise -> Disparage someone’s genuine achievements.',
    example: 'It is unfair to disparage the honest hard work of sanitation staff.',
  },
  'dogmatic': {
    hindi: 'कट्टर / हठधर्मी',
    english: 'Inclined to lay down principles as incontrovertibly true without evidence.',
    mnemonic: 'Dogma strictly follow karne wala = Dogmatic.',
    example: 'His dogmatic insistence on outdated procedures hindered innovation.',
  },
  'ebullient': {
    hindi: 'उत्साही / उमंग से भरा',
    english: 'Cheerful and full of energy; exuberant.',
    mnemonic: 'Boiling with positive energy -> Ebullient mood.',
    example: 'The team erupted into an ebullient celebration after clinching the tournament.',
  },
  'eccentric': {
    hindi: 'विचित्र / अजीब / सनकी',
    english: 'Unconventional and slightly strange in behavior or views.',
    mnemonic: 'Out of center (Ex-centric) = Eccentric habits.',
    example: 'The eccentric mathematician lived a secluded life surrounded by ancient texts.',
  },
  'efficacious': {
    hindi: 'प्रभावशाली / अचूक',
    english: 'Successful in producing a desired or intended result; effective.',
    mnemonic: 'Effective action -> Efficacious remedy.',
    example: 'Yoga proved to be an efficacious therapy for chronic back pain.',
  },
  'egregious': {
    hindi: 'अत्यंत बुरा / कुख्यात',
    english: 'Outstandingly bad; shocking; glaringly evident.',
    mnemonic: 'Egg thrown on face -> Egregious error.',
    example: 'The inquiry revealed egregious violations of environmental norms by the refinery.',
  },
  'eloquent': {
    hindi: 'सुवक्ता / प्रभावशाली वक्ता',
    english: 'Fluent or persuasive in speaking or writing.',
    mnemonic: 'Root Loq (Speak) = Expressive, articulate speaker.',
    example: 'His eloquent address at the United Nations inspired diplomats worldwide.',
  },
  'elucidate': {
    hindi: 'स्पष्ट करना / व्याख्या करना',
    english: 'Make (something) clear; explain and clarify.',
    mnemonic: 'Lucid (clear) banana -> Elucidate the complex theorem.',
    example: 'The professor took time to elucidate the fundamental laws of thermodynamics.',
    root: 'Latin lucidus ("bright, clear").',
  },
  'enervate': {
    hindi: 'कमजोर करना / शक्तिहीन करना',
    english: 'Cause (someone) to feel drained of energy or vitality; weaken.',
    mnemonic: 'Energy-waste -> Enervated in scorching summer heat.',
    example: 'The oppressive humidity of the tropical jungle quickly enervated the hikers.',
  },
  'enigma': {
    hindi: 'पहेली / रहस्य',
    english: 'A person or thing that is mysterious, puzzling, or difficult to understand.',
    mnemonic: 'Enigma machine -> Famous WWII code riddle.',
    example: 'The disappearance of the Indus Valley civilization remains a historical enigma.',
  },
  'ephemeral': {
    hindi: 'क्षणिक / अल्पकालिक',
    english: 'Lasting for a very short time; fleeting.',
    mnemonic: 'E-paper charm fades in a few hours -> Ephemeral.',
    example: 'Fame on social media can be surprisingly ephemeral.',
  },
  'equivocal': {
    hindi: 'अस्पष्ट / द्विअर्थी / संदिग्ध',
    english: 'Open to more than one interpretation; ambiguous; uncertain.',
    mnemonic: 'Equal vocal on both sides -> Equivocal answer.',
    example: 'The minister gave an equivocal response regarding future tax revisions.',
  },
  'erudite': {
    hindi: 'विद्वान / ज्ञानी',
    english: 'Having or showing great knowledge or learning; scholarly.',
    mnemonic: 'Rude nahi, scholarly person is Erudite.',
    example: 'The panel featured erudite historians debating maritime trade routes.',
  },
  'esoteric': {
    hindi: 'गूढ़ / केवल विशेषज्ञों द्वारा समझ आने वाला',
    english: 'Intended for or likely to be understood by only a small number of people.',
    mnemonic: '100 log me se sirf thode ko samajh aana -> Esoteric.',
    example: 'Quantum entanglement remains an esoteric topic for general readers.',
  },
  'eulogy': {
    hindi: 'प्रशंसा-गान / स्तुति',
    english: 'A speech or piece of writing that praises someone highly, especially after death.',
    mnemonic: 'Eu (Good) + Logy (Word) = Words of high praise.',
    example: 'He delivered a moving eulogy honoring the sacrifices of his mentor.',
  },
  'exacerbate': {
    hindi: 'बिगाड़ना / बदतर बनाना',
    english: 'Make (a problem, bad situation, or negative feeling) worse.',
    mnemonic: 'Ex-kar-diya batein -> Situation aur kharab ho gayi.',
    example: 'Drought conditions served to exacerbate the existing agrarian crisis.',
  },
  'exonerate': {
    hindi: 'दोषमुक्त करना / बरी करना',
    english: 'Absolve (someone) from blame for a fault or wrongdoing.',
    mnemonic: 'Ex-honour wapas milna -> Exonerated by judicial verdict.',
    example: 'DNA evidence was instrumental in exonerating the wrongfully convicted prisoner.',
    root: 'Latin exonerare ("to free from a burden").',
  },
  'fastidious': {
    hindi: 'तुनकमिजाज / जिसे खुश करना कठिन हो',
    english: 'Very attentive to and concerned about accuracy and detail.',
    mnemonic: 'Fastidious = Nakchadhi; everything must be immaculate.',
    example: 'The head chef was fastidious about the temperature of each culinary dish.',
  },
  'fickle': {
    hindi: 'चंचल / अस्थिर',
    english: 'Changing frequently, especially as regards one’s loyalties, interests, or affection.',
    mnemonic: 'Fickle minded = Unsteady and unpredictable.',
    example: 'Consumer loyalty in the smartphone segment can be notoriously fickle.',
  },
  'frugal': {
    hindi: 'मितव्ययी / किफायती',
    english: 'Sparing or economical with regard to money or food; simple and plain.',
    mnemonic: 'Free + Gal = Kharch kam karne wali; economical.',
    example: 'Through frugal living and disciplined savings, he bought his family a home.',
  },
  'garrulous': {
    hindi: 'बातूनी / वाचाल',
    english: 'Excessively talkative, especially on trivial matters.',
    mnemonic: 'Girl rail me lagatar bolti gayi -> Garrulous speaker.',
    example: 'The garrulous passenger shared his entire life history during the train journey.',
  },
  'gregarious': {
    hindi: 'मिलनसार / झुंड में रहने वाला',
    english: 'Fond of company; sociable; living in flocks or colonies.',
    mnemonic: 'Root Greg (Flock) = Social animal that loves company.',
    example: 'Dolphins are gregarious creatures that travel and hunt in tight pods.',
  },
  'guile': {
    hindi: 'छल-कपट / धूर्तता',
    english: 'Sly or cunning intelligence; craftiness.',
    mnemonic: 'Guilty person uses guile to evade justice.',
    example: 'The trickster used clever guile to swindle trusting tourists.',
  },
  'haughty': {
    hindi: 'घमंडी / अभिमानी',
    english: 'Arrogantly superior and disdainful; disdainful.',
    mnemonic: 'Hath upar karke chalne wala ghamandi person = Haughty.',
    example: 'Her haughty demeanor alienated many longtime colleagues.',
  },
  'iconoclast': {
    hindi: 'रूढ़ि-विरोधी / पुरानी मान्यताओं को तोड़ने वाला',
    english: 'A person who attacks cherished beliefs or established institutions.',
    mnemonic: 'Icon + Clast (Break) = Breaker of traditional idols and dogmas.',
    example: 'Raja Ram Mohan Roy was an iconoclast who crusaded against obsolete orthodox customs.',
  },
  'impeccable': {
    hindi: 'त्रुटिहीन / निष्कलंक',
    english: 'In accordance with the highest standards of propriety; faultless.',
    mnemonic: 'Im (Not) + Pecca (Sin/Flaw) = Flawless without any mistake.',
    example: 'The officer maintained an impeccable service record throughout his career.',
  },
  'impudent': {
    hindi: 'गुस्ताख / ढीठ / बदतमीज',
    english: 'Not showing due respect for another person; impertinent.',
    mnemonic: 'Im (No) + Prudent (Wisdom) = Rude and insolent.',
    example: 'The impudent student was reprimanded for interrupting the principal.',
  },
  'indolent': {
    hindi: 'आलसी / अकर्मण्य',
    english: 'Wanting to avoid activity or exertion; lazy.',
    mnemonic: 'In-dolt: Sona aur aalsi rehna -> Indolent.',
    example: 'He spent indolent summer afternoons lounging by the shade of the mango grove.',
  },
  'innocuous': {
    hindi: 'अहानिकर / सीधा-सादा',
    english: 'Not harmful or offensive; harmless.',
    mnemonic: 'In (Not) + Nocuous (Harmful) = Harmless.',
    example: 'The doctor assured him that the mild rash was completely innocuous.',
  },
  'intrepid': {
    hindi: 'निडर / साहसी',
    english: 'Fearless; adventurous; dauntless.',
    mnemonic: 'In-trapped condition me bhi no fear -> Intrepid mountaineer.',
    example: 'The intrepid mountaineers persevered despite sub-zero blizzards.',
  },
  'laconic': {
    hindi: 'संक्षिप्त / कम शब्दों में बोलने वाला',
    english: 'Using very few words; concise to the point of seeming rude.',
    mnemonic: 'Lack of conic words = Laconic reply ("Yes" or "No").',
    example: 'The general sent a laconic telegram simply reading: "Objective secured."',
  },
  'lethargic': {
    hindi: 'सुस्त / शिथिल / मंद',
    english: 'Affected by lethargy; sluggish and apathetic.',
    mnemonic: 'Late-hargic -> Lazy and drowsy.',
    example: 'Heavy meals often make one feel lethargic and unproductive in the afternoon.',
  },
  'loquacious': {
    hindi: 'वाचाल / बहुत बोलने वाला',
    english: 'Tending to talk a great deal; talkative.',
    mnemonic: 'Root Loq (Speak) -> Loquacious companion on a road trip.',
    example: 'The loquacious host kept everyone entertained with endless humorous anecdotes.',
  },
  'lucid': {
    hindi: 'स्पष्ट / बोधगम्य',
    english: 'Expressed clearly; easy to understand; bright.',
    mnemonic: 'Lucid dream = Crystal clear perception.',
    example: 'The author provided a lucid explanation of complex monetary policy.',
  },
  'magnanimous': {
    hindi: 'उदार / बड़े दिल वाला',
    english: 'Generous or forgiving, especially toward a rival or less powerful person.',
    mnemonic: 'Maha-animus (Great soul) = Generous and forgiving.',
    example: 'The victorious general was magnanimous in granting amnesty to surrendered troops.',
    root: 'Latin magnus ("great") + animus ("soul, mind").',
  },
  'meticulous': {
    hindi: 'अति-सावधान / बारीक काम करने वाला',
    english: 'Showing great attention to detail; very careful and precise.',
    mnemonic: 'Mitti ke kan-kan ka hisab = Meticulous audit.',
    example: 'Archaeologists conducted a meticulous excavation of the ancient burial site.',
  },
  'mitigate': {
    hindi: 'कम करना / शांत करना',
    english: 'Make less severe, serious, or painful; alleviate.',
    mnemonic: 'Mitti daal kar aag mitigate (kam) karna.',
    example: 'The afforestation project aimed to mitigate soil erosion across the riverbank.',
  },
  'nefarious': {
    hindi: 'कुटिल / अधर्मी / दुष्ट',
    english: 'Wicked, villainous, or criminal in nature.',
    mnemonic: 'Narak me bhejne jaisa nefarious crime.',
    example: 'The police busted a nefarious syndicate involved in counterfeit medication.',
  },
  'obsequious': {
    hindi: 'चापलूस / खुशामदी',
    english: 'Obedient or attentive to an excessive or servile degree.',
    mnemonic: 'Observation me sirf "Yes Sir" bolne wala chaploos.',
    example: 'The corrupt minister was surrounded by obsequious flatterers.',
  },
  'obstinate': {
    hindi: 'हठी / ज़िद्दी / अड़ियल',
    english: 'Stubbornly refusing to change one’s opinion or chosen course of action.',
    mnemonic: 'Obstacle ban jana zidd me = Obstinate child.',
    example: 'Despite repeated medical advice, the obstinate patient refused to quit smoking.',
  },
  'onerous': {
    hindi: 'कष्टसाध्य / भारी / श्रमसाध्य',
    english: 'Involving an amount of effort and difficulty that is oppressively burdensome.',
    mnemonic: 'One-ton weight uthana is onerous duty.',
    example: 'Managing dual jobs proved to be an onerous burden for the single mother.',
  },
  'opulent': {
    hindi: 'धनी / भव्य / ऐश्वर्यपूर्ण',
    english: 'Ostentatiously rich and luxurious or lavish; wealthy.',
    mnemonic: 'Opal and diamond jaisa luxurious lifestyle = Opulent.',
    example: 'The visiting dignitaries were hosted in the opulent state banquet hall.',
  },
  'panacea': {
    hindi: 'रामबाण औषधि / सर्वरोगहारी',
    english: 'A solution or remedy for all difficulties or diseases; a cure-all.',
    mnemonic: 'Pan (All) + Acea (Cure) = Cure for all ailments.',
    example: 'Technology alone is not a panacea for deep-rooted societal inequalities.',
  },
  'paucity': {
    hindi: 'अल्पता / कमी / न्यूनता',
    english: 'The presence of something only in small or insufficient quantities; scarcity.',
    mnemonic: 'Pau (Paw/little bit) = Scarcity or paucity.',
    example: 'The committee lamented the paucity of authentic historical records.',
  },
  'perfunctory': {
    hindi: 'लापरवाह / बेमन से किया गया',
    english: 'Carried out with a minimum of effort or reflection; hasty and superficial.',
    mnemonic: 'Perform mechanically without interest = Perfunctory check.',
    example: 'The security guard gave our bags only a perfunctory glance.',
  },
  'pragmatic': {
    hindi: 'व्यावहारिक / यथार्थवादी',
    english: 'Dealing with things sensibly and realistically in a way that is based on practical considerations.',
    mnemonic: 'Practical approach = Pragmatic decisions.',
    example: 'The finance minister took a pragmatic approach to contain fiscal deficit.',
  },
  'prolific': {
    hindi: 'फलदायक / बहुप्रज / विपुल',
    english: 'Producing much fruit or foliage or many works; highly productive.',
    mnemonic: 'Pro + Life: Abundant output produced.',
    example: 'Rabindranath Tagore was a prolific writer who composed thousands of poems and songs.',
  },
  'puritanical': {
    hindi: 'नैतिकतावादी / अत्यधिक नियमनिष्ठ / कट्टर',
    english: 'Having or displaying excessively strict moral or religious views.',
    mnemonic: 'Puri + Tan (strict) + ical: People who are too strict about purity in daily moral life.',
    example: 'The Victorian era was known for its puritanical approach to literature and dress.',
    root: 'Latin puritas ("purity").',
  },
  'prudish': {
    hindi: 'आवश्यकता से अधिक नैतिक / दकियानूसी / लज्जाशील',
    english: 'Excessively proper, modest, or easily shocked by matters relating to modesty or morality.',
    mnemonic: 'Prude + ish: Someone acting like a prude over normal expressions.',
    example: 'Her prudish relatives frowned at modern relaxed clothing styles.',
    root: 'Old French prude ("virtuous, modest woman").',
  },
  'permissive': {
    hindi: 'उदार / अत्यधिक छूट देने वाला / सहनशील',
    english: 'Allowing or characterized by great or excessive freedom of behavior.',
    mnemonic: 'Permission dene wala = Permissive attitude.',
    example: 'Permissive parenting styles can sometimes lead to disciplinary issues.',
  },
  'orthodox': {
    hindi: 'रूढ़िवादी / परंपरावादी / कट्टर',
    english: 'Following or conforming to traditional or generally accepted rules or beliefs.',
    mnemonic: 'Ortho (straight/conventional) + dox (belief) = Strictly conforming to tradition.',
    example: 'He held orthodox religious opinions and adhered to ancient ceremonies.',
  },
  'blasphemous': {
    hindi: 'ईशनिंदक / धर्मविरोधी / अपवित्र',
    english: 'Sacrilegious against God or sacred things; profane.',
    mnemonic: 'Blast against faith = Blasphemous utterance.',
    example: 'The publication was banned after being declared blasphemous by authorities.',
  },
  'quixotic': {
    hindi: 'अव्यावहारिक / ख्याली पुलाव पकाने वाला',
    english: 'Exceedingly idealistic; unrealistic and impractical.',
    mnemonic: 'Don Quixote: Imaginary windmills se ladne wala = Quixotic.',
    example: 'His scheme to end world poverty in six months was dismissed as quixotic.',
  },
  'rancor': {
    hindi: 'शत्रुता / द्वेष / कड़वाहट',
    english: 'Bitterness or resentfulness, especially when long-standing.',
    mnemonic: 'Rank khone par resentment and rancor develop hona.',
    example: 'Despite a fierce courtroom battle, the two attorneys parted without rancor.',
  },
  'reticent': {
    hindi: 'संकोची / चुप रहने वाला',
    english: 'Not revealing one’s thoughts or feelings readily; reserved.',
    mnemonic: 'Re-ticket counter par shanti se chup rehna.',
    example: 'He was notoriously reticent about discussing his wartime military service.',
  },
  'salubrious': {
    hindi: 'स्वास्थ्यवर्धक / आरोग्यकारी',
    english: 'Health-giving; healthy; pleasant and beneficial.',
    mnemonic: 'Salute to good health -> Salubrious hill station climate.',
    example: 'They moved to Himachal to enjoy the fresh, salubrious mountain air.',
  },
  'sanguine': {
    hindi: 'आशावादी / प्रसन्नचित्त',
    english: 'Optimistic or positive, especially in an apparently bad or difficult situation.',
    mnemonic: 'Sang (with) + Wine: Cheerful and optimistic outlook.',
    example: 'Despite the early election setbacks, the party leadership remained sanguine.',
  },
  'scrupulous': {
    hindi: 'कर्तव्यनिष्ठ / अत्यंत ईमानदार व सावधान',
    english: 'Diligent, thorough, and extremely attentive to details and moral principles.',
    mnemonic: 'Scruple (moral doubt) rakhkar honest rehna = Scrupulous clerk.',
    example: 'The researcher was scrupulous in acknowledging every single source.',
  },
  'spurious': {
    hindi: 'नकली / जाली / बनावटी',
    english: 'Not being what it purports to be; false or fake; illegitimate.',
    mnemonic: 'Pure nahi hai jo = Spurious medicines in market.',
    example: 'Police confiscated consignments of spurious drugs and counterfeit cosmetics.',
  },
  'surreptitious': {
    hindi: 'गुप्त / छल से किया गया',
    english: 'Kept secret, especially because it would not be approved of; stealthy.',
    mnemonic: 'Surrender secretly -> Surreptitious recording.',
    example: 'He cast a surreptitious glance at his rival’s examination answer sheet.',
  },
  'taciturn': {
    hindi: 'अल्पभाषी / कम बोलने वाला',
    english: 'Habitually reserved or uncommunicative in speech; saying little.',
    mnemonic: 'Taxi-driver turns lete waqt bilkul silent rehta hai.',
    example: 'The accused remained taciturn throughout the police interrogation.',
  },
  'tenacious': {
    hindi: 'दृढ़ / लगनशील / हठी',
    english: 'Tending to keep a firm hold of something; clinging; persistent.',
    mnemonic: 'Ten men power in holding on = Tenacious grip.',
    example: 'Her tenacious pursuit of justice finally exposed the corporate syndicate.',
  },
  'ubiquitous': {
    hindi: 'सर्वव्यापी / हर जगह मौजूद',
    english: 'Present, appearing, or found everywhere; omnipresent.',
    mnemonic: 'You-be-everywhere = Ubiquitous smartphones.',
    example: 'Mobile payment QR codes have become ubiquitous across Indian retail markets.',
  },
  'vacillate': {
    hindi: 'हिचकिचाना / डगमगाना',
    english: 'Alternate or waver between different opinions or actions; be indecisive.',
    mnemonic: 'Oscillate jaise idhar-udhar hilna = Vacillate in taking decisions.',
    example: 'Do not vacillate between career choices; pick a goal and dedicate yourself.',
  },
  'venerable': {
    hindi: 'आदरणीय / पूज्य',
    english: 'Accorded a great deal of respect, especially because of age, wisdom, or character.',
    mnemonic: 'Van-elder = Respected and venerable teacher.',
    example: 'The venerable freedom fighter was felicitated on Independence Day.',
  },
  'veracious': {
    hindi: 'सच्चा / सत्यवादी',
    english: 'Speaking or representing the truth; truthful; accurate.',
    mnemonic: 'Root Ver (Truth) = Veracious testimony in court.',
    example: 'The officer was respected as a thoroughly veracious and upright public servant.',
  },
  'vilify': {
    hindi: 'बदनाम करना / कलंकित करना',
    english: 'Speak or write about in an abusively disparaging manner; defame.',
    mnemonic: 'Villain banana publicity me = Vilify someone.',
    example: 'Scurrilous tabloids attempted to vilify the whistleblower’s reputation.',
  },
  'vindicate': {
    hindi: 'सही साबित करना / दोषमुक्त करना',
    english: 'Clear (someone) of blame or suspicion; show or prove to be right.',
    mnemonic: 'Win-the-case and establish truth = Vindicate honor.',
    example: 'Subsequent forensic evidence served to completely vindicate the young scientist.',
  },
  'virulent': {
    hindi: 'घातक / विषैला / कटु',
    english: 'Extremely severe or harmful in its effects; bitterly hostile.',
    mnemonic: 'Virus-like lethal or poisonous attack = Virulent outbreak.',
    example: 'The patient succumbed to a virulent strain of bacterial pneumonia.',
  },
  'volatile': {
    hindi: 'अस्थिर / परिवर्तनशील / भड़कने वाला',
    english: 'Liable to change rapidly and unpredictably, especially for the worse.',
    mnemonic: 'Petrol is volatile (evaporates easily); temper is volatile (erupts fast).',
    example: 'The border region remained politically volatile following the coup.',
  },
  'voracious': {
    hindi: 'पेटू / भुक्खड़ / अतृप्त',
    english: 'Wanting or devouring great quantities of food; having a very eager approach.',
    mnemonic: 'Vora (Bora bhar ke khane wala) = Voracious appetite.',
    example: 'A voracious reader, she finished three thick historical biographies every week.',
  },
  'zealous': {
    hindi: 'उत्साही / कर्मठ / कट्टर',
    english: 'Having or showing great energy or enthusiasm in pursuit of a cause.',
    mnemonic: 'Full of Zeal = Zealous volunteer.',
    example: 'The zealous campaign volunteers worked day and night distributing pamphlets.',
  },
  'zenith': {
    hindi: 'शीर्ष बिंदु / पराकाष्ठा',
    english: 'The time at which something is most powerful or successful; peak.',
    mnemonic: 'Zenith opposite of Nadir = Highest summit of success.',
    example: 'The Mughal Empire reached its territorial zenith during the 17th century.',
  },
};

/**
 * Normalizes input words by stripping punctuation, extra spaces, and converting to lowercase.
 */
function normalizeKey(str: string): string {
  if (!str) return '';
  return str.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Searches our comprehensive master vocabulary table or returns null.
 */
export function lookupMasterEntry(word: string): VocabMasterRecord | null {
  if (!word) return null;
  const rawLower = word.trim().toLowerCase();
  const clean = normalizeKey(rawLower);

  // 1. Direct match
  if (HIGH_YIELD_EXAM_VOCAB[rawLower]) return HIGH_YIELD_EXAM_VOCAB[rawLower];
  if (HIGH_YIELD_EXAM_VOCAB[clean]) return HIGH_YIELD_EXAM_VOCAB[clean];

  // 2. Lookup in ALL_VOCAB_MASTER from questionBankEngine
  const foundInEngine = ALL_VOCAB_MASTER.find(
    entry => entry.word.toLowerCase() === rawLower || normalizeKey(entry.word) === clean
  );
  if (foundInEngine) {
    return {
      hindi: foundInEngine.hindi,
      english: foundInEngine.meaning,
      mnemonic: foundInEngine.mnemonic,
      example: foundInEngine.example,
      root: foundInEngine.root,
    };
  }

  // 3. Substring / Stem match in HIGH_YIELD_EXAM_VOCAB
  for (const [k, v] of Object.entries(HIGH_YIELD_EXAM_VOCAB)) {
    if (k.length >= 4 && (clean.startsWith(k) || k.startsWith(clean))) {
      return v;
    }
  }

  return null;
}

/**
 * Resolves disambiguated educational meanings for both the target word (e.g. puritanical)
 * and the correct option (e.g. prudish) to prevent student confusion in synonyms/antonyms.
 */
export function resolveQuestionMeaningsBreakdown(question: {
  question?: string;
  wordOrPhrase?: string;
  category?: string;
  options?: string[];
  correctIndex?: number | null;
  meaning?: string;
  englishMeaning?: string;
  hindiMeaning?: string;
  optionDetails?: any[];
}): QuestionMeaningsBreakdown {
  if (!question) {
    return {
      targetWord: 'Vocabulary',
      targetMeaning: 'Standard examination vocabulary term.',
      targetHindi: 'प्रतियोगी परीक्षा हेतु महत्वपूर्ण शब्दार्थ',
      combinedEnglishText: 'Vocabulary – Standard examination vocabulary term.',
      combinedHindiText: 'Vocabulary: प्रतियोगी परीक्षा हेतु महत्वपूर्ण शब्दार्थ',
    };
  }

  const rawCat = (question.category || '').toLowerCase();
  const rawQText = (question.question || '').toLowerCase();

  const isSynonym = rawCat.includes('synonym') || rawQText.includes('synonym') || (!rawCat && !rawQText);
  const isAntonym = rawCat.includes('antonym') || rawQText.includes('antonym');
  const isOWS = rawCat.includes('ows') || rawCat.includes('one word') || rawQText.includes('one word') || rawQText.includes('substitut');
  const isIdiom = rawCat.includes('idiom') || rawCat.includes('phrase') || rawQText.includes('idiom') || rawQText.includes('phrase');
  const isDuoCategory = isSynonym || isAntonym;

  // 1. Extract clean target word
  let targetWord = (question.wordOrPhrase || '').trim();
  if (!targetWord && question.question) {
    const quoteMatch = question.question.match(/["']([^"']+)["']/);
    if (quoteMatch && quoteMatch[1] && quoteMatch[1].length <= 45) {
      targetWord = quoteMatch[1].trim();
    } else {
      targetWord = question.question.trim();
    }
  }
  // Strip outer quotes
  targetWord = targetWord.replace(/^["']+|["']+$/g, '').trim();

  // 2. Identify correct option
  const correctIdx = typeof question.correctIndex === 'number' ? question.correctIndex : null;
  const correctOption = (correctIdx !== null && Array.isArray(question.options) && question.options[correctIdx])
    ? String(question.options[correctIdx]).replace(/^["']+|["']+$/g, '').trim()
    : undefined;

  const isDistinctCorrect = Boolean(
    correctOption &&
    targetWord &&
    normalizeKey(correctOption) !== normalizeKey(targetWord)
  );

  // Helper to split text joined by bullet points, newlines, or pipes
  const splitCombined = (text: string): [string, string] => {
    if (!text) return ['', ''];
    const delimiterRegex = /(?:\r?\n\s*[•·\-\*]\s*|\s+[•·]\s+|\s*\|\s*|\s*\/\/\s*)/;
    const parts = text.split(delimiterRegex);
    if (parts.length >= 2) {
      return [parts[0].trim(), parts.slice(1).join(' ').trim()];
    }
    return [text.trim(), ''];
  };

  // 3. Resolve Target Meaning
  const rawMeaning = (question.meaning || question.englishMeaning || '').trim();
  let targetMeaning = '';
  let extractedCorrectMeaningFromRaw = '';

  const [part1English, part2English] = splitCombined(rawMeaning);
  targetMeaning = part1English;
  if (part2English) extractedCorrectMeaningFromRaw = part2English;

  // Clean target meaning from pre-existing word prefix if already there
  if (targetWord && targetMeaning) {
    const prefixRegex = new RegExp(`^${targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[-–:]\\s*`, 'i');
    targetMeaning = targetMeaning.replace(prefixRegex, '').trim();
  }
  // Clean generic prefix
  targetMeaning = targetMeaning.replace(/^(?:target\s*word|given\s*word|question\s*term|word|meaning)\s*[-–:]\s*/i, '').trim();

  // OWS lookup for target word
  if (isOWS) {
    const owsMatch = OWS_MASTER_EXTENDED.find(
      o => o.answer.toLowerCase() === targetWord.toLowerCase() ||
           normalizeKey(o.answer) === normalizeKey(targetWord) ||
           o.phrase.toLowerCase().includes(targetWord.toLowerCase().slice(0, 25)) ||
           targetWord.toLowerCase().includes(o.phrase.toLowerCase().slice(0, 25))
    );
    if (owsMatch) {
      if (!targetMeaning) targetMeaning = owsMatch.meaning || owsMatch.phrase;
    }
  }

  // Idiom lookup for target word
  if (isIdiom) {
    const idiomMatch = IDIOM_MASTER_EXTENDED.find(
      idm => normalizeKey(idm.idiom) === normalizeKey(targetWord) ||
             idm.idiom.toLowerCase().includes(targetWord.toLowerCase()) ||
             targetWord.toLowerCase().includes(idm.idiom.toLowerCase())
    );
    if (idiomMatch && !targetMeaning) {
      targetMeaning = idiomMatch.meaning;
    }
  }

  const targetLookup = lookupMasterEntry(targetWord);
  if (targetLookup?.english) {
    // If targetWord has authoritative dictionary entry and targetMeaning was empty, repetitive, or describing correctOption
    const describesAnswer = correctOption && targetMeaning.toLowerCase().startsWith(correctOption.toLowerCase());
    const isRepetitive = targetMeaning.includes('(Synonym') || targetMeaning.includes('(Antonym') || targetMeaning.length < 5;
    if (!targetMeaning || describesAnswer || isRepetitive) {
      targetMeaning = targetLookup.english;
    }
  }

  if (!targetMeaning) {
    if (targetLookup?.english) {
      targetMeaning = targetLookup.english;
    } else if (isSynonym) {
      targetMeaning = correctOption
        ? `Denotes qualities closely aligned with "${correctOption}".`
        : 'High-yield examination vocabulary term.';
    } else if (isAntonym) {
      targetMeaning = correctOption
        ? `Expresses a state or quality in direct opposition to "${correctOption}".`
        : 'High-yield examination vocabulary term.';
    } else if (isOWS) {
      targetMeaning = 'High-frequency one-word substitution examination concept.';
    } else if (isIdiom) {
      targetMeaning = 'Authentic competitive exam idiom and phrase requirement.';
    } else {
      targetMeaning = 'High-yield competitive examination concept.';
    }
  }

  // 4. Resolve Target Hindi
  const rawHindi = (question.hindiMeaning || '').trim();
  let targetHindi = '';
  let extractedCorrectHindiFromRaw = '';

  const [part1Hindi, part2Hindi] = splitCombined(rawHindi);
  targetHindi = part1Hindi;
  if (part2Hindi) extractedCorrectHindiFromRaw = part2Hindi;

  if (targetWord && targetHindi) {
    const prefixHindiRegex = new RegExp(`^${targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[-–:]\\s*`, 'i');
    targetHindi = targetHindi.replace(prefixHindiRegex, '').trim();
  }
  targetHindi = targetHindi.replace(/^(?:target\s*word|word|हिन्दी|भावार्थ|अर्थ)\s*[-–:]\s*/i, '').trim();
  targetHindi = targetHindi.replace(/\s*।\s*$/, '').trim();

  // OWS / Idioms Hindi lookup
  if (isOWS && !targetHindi) {
    const owsMatch = OWS_MASTER_EXTENDED.find(
      o => o.answer.toLowerCase() === targetWord.toLowerCase() ||
           normalizeKey(o.answer) === normalizeKey(targetWord)
    );
    if (owsMatch?.hindi) targetHindi = owsMatch.hindi;
  }
  if (isIdiom && !targetHindi) {
    const idiomMatch = IDIOM_MASTER_EXTENDED.find(
      idm => normalizeKey(idm.idiom) === normalizeKey(targetWord)
    );
    if (idiomMatch?.hindi) targetHindi = idiomMatch.hindi;
  }

  if (targetLookup?.hindi) {
    const describesAnswerHindi = correctOption && targetHindi.toLowerCase().startsWith(correctOption.toLowerCase());
    const isRepetitiveHindi = targetHindi.includes('(Synonym') || targetHindi.includes('(Antonym') || targetHindi.length < 3;
    if (!targetHindi || describesAnswerHindi || isRepetitiveHindi) {
      targetHindi = targetLookup.hindi;
    }
  }

  if (!targetHindi) {
    if (targetLookup?.hindi) {
      targetHindi = targetLookup.hindi;
    } else {
      targetHindi = `"${targetWord}" का यथार्थ शब्दार्थ`;
    }
  }

  // 5. Resolve Correct Option Meaning & Hindi
  let correctMeaning: string | undefined;
  let correctHindi: string | undefined;

  if (isDistinctCorrect && correctOption) {
    // Check if extracted from raw combined
    if (extractedCorrectMeaningFromRaw) {
      let cleaned = extractedCorrectMeaningFromRaw;
      const cleanPrefixRegex = new RegExp(`^${correctOption.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s*\\([^)]*\\))?\\s*[-–:]\\s*`, 'i');
      cleaned = cleaned.replace(cleanPrefixRegex, '').trim();
      cleaned = cleaned.replace(/^(?:\([^)]*\)|correct\s*answer|answer|meaning|option)\s*[-–:]\s*/i, '').trim();
      if (cleaned) correctMeaning = cleaned;
    }

    if (extractedCorrectHindiFromRaw) {
      let cleanedHindi = extractedCorrectHindiFromRaw;
      const cleanOptionPrefixRegex = new RegExp(`^${correctOption.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s*\\([^)]*\\))?\\s*[-–:]\\s*`, 'i');
      cleanedHindi = cleanedHindi.replace(cleanOptionPrefixRegex, '').trim();
      cleanedHindi = cleanedHindi.replace(/^(?:\([^)]*\)|correct\s*answer|answer|हिन्दी|भावार्थ|अर्थ)\s*[-–:]\s*/i, '').trim();
      cleanedHindi = cleanedHindi.replace(/\s*।\s*$/, '').trim();
      if (cleanedHindi) correctHindi = cleanedHindi;
    }

    // Check optionDetails on question
    if (!correctMeaning && correctIdx !== null && Array.isArray(question.optionDetails) && question.optionDetails[correctIdx]) {
      const od = question.optionDetails[correctIdx];
      const odEnglish = (od.englishMeaning || od.meaning || '').trim();
      if (odEnglish && odEnglish.toLowerCase() !== targetMeaning.toLowerCase()) {
        correctMeaning = odEnglish;
      }
      const odHindi = (od.hindiMeaning || '').trim();
      if (odHindi && odHindi.toLowerCase() !== targetHindi.toLowerCase()) {
        correctHindi = odHindi;
      }
    }

    // Lookup OWS master data for correctOption
    if (isOWS && (!correctMeaning || !correctHindi)) {
      const owsOptMatch = OWS_MASTER_EXTENDED.find(
        o => o.answer.toLowerCase() === correctOption.toLowerCase() ||
             normalizeKey(o.answer) === normalizeKey(correctOption) ||
             o.phrase.toLowerCase().includes(correctOption.toLowerCase().slice(0, 25))
      );
      if (owsOptMatch) {
        if (!correctMeaning) correctMeaning = owsOptMatch.meaning || owsOptMatch.phrase;
        if (!correctHindi) correctHindi = owsOptMatch.hindi;
      }
    }

    // Lookup Idioms master data for correctOption
    if (isIdiom && (!correctMeaning || !correctHindi)) {
      const idiomOptMatch = IDIOM_MASTER_EXTENDED.find(
        idm => normalizeKey(idm.idiom) === normalizeKey(correctOption) ||
               idm.meaning.toLowerCase().includes(correctOption.toLowerCase())
      );
      if (idiomOptMatch) {
        if (!correctMeaning) correctMeaning = idiomOptMatch.meaning;
        if (!correctHindi) correctHindi = idiomOptMatch.hindi;
      }
    }

    // Lookup master dictionary entry for correctOption
    if (!correctMeaning || !correctHindi) {
      const correctLookup = lookupMasterEntry(correctOption);
      if (!correctMeaning && correctLookup?.english) {
        correctMeaning = correctLookup.english;
      }
      if (!correctHindi && correctLookup?.hindi) {
        correctHindi = correctLookup.hindi;
      }
    }

    // Fallbacks for specific categories
    if (!correctMeaning) {
      if (isSynonym) {
        correctMeaning = `Accurately corresponds to "${targetWord}", conveying the equivalent contextual meaning.`;
      } else if (isAntonym) {
        correctMeaning = `Expresses the contrasting or polar opposite state of "${targetWord}".`;
      } else if (isOWS) {
        correctMeaning = correctOption.split(' ').length > 2
          ? `Detailed definition and contextual meaning corresponding to "${targetWord}".`
          : `Precise one-word substitution for the given description.`;
      } else if (isIdiom) {
        correctMeaning = `Conveys the authentic figurative meaning of "${targetWord}".`;
      } else {
        correctMeaning = `Accurately satisfies the question requirement.`;
      }
    }

    if (!correctHindi) {
      if (isSynonym) {
        correctHindi = `"${targetWord}" का सटीक समानार्थी अर्थ`;
      } else if (isAntonym) {
        correctHindi = `"${targetWord}" का विलोमार्थी भाव`;
      } else if (isOWS) {
        correctHindi = `"${targetWord}" का सटीक यथार्थ अर्थ / प्रतिस्थापन`;
      } else if (isIdiom) {
        correctHindi = `मुहावरे "${targetWord}" का वास्तविक भावार्थ`;
      } else {
        correctHindi = `दिए गए प्रश्न का सटीक उत्तर`;
      }
    }
  }

  // 6. Descriptive Target & Category Labels
  let targetLabel = 'Question Term';
  let categoryLabel = 'Correct Answer';
  let categoryLabelHindi = 'सटीक उत्तर';

  if (isOWS) {
    targetLabel = targetWord.split(' ').length > 2 ? 'Given Phrase' : 'Question Term';
    categoryLabel = (correctOption && correctOption.split(' ').length <= 2) ? 'One Word' : 'Correct Answer';
    categoryLabelHindi = 'एक शब्द';
  } else if (isIdiom) {
    targetLabel = 'Idiom / Phrase';
    categoryLabel = 'Meaning';
    categoryLabelHindi = 'भावार्थ';
  } else if (isSynonym) {
    targetLabel = 'Target Word';
    categoryLabel = 'Synonym';
    categoryLabelHindi = 'समानार्थी';
  } else if (isAntonym) {
    targetLabel = 'Target Word';
    categoryLabel = 'Antonym';
    categoryLabelHindi = 'विलोमार्थी';
  }

  // 7. Format combined strings cleanly without nested parentheses
  const cleanTargetDisplay = targetWord || 'Word';
  const targetLineEnglish = `${cleanTargetDisplay} – ${targetMeaning}`;
  const targetLineHindi = `${cleanTargetDisplay}: ${targetHindi}`;

  let combinedEnglishText = targetLineEnglish;
  if (isDistinctCorrect && correctOption && correctMeaning) {
    const cleanCorrectEng = correctMeaning.replace(/\((?:Synonym|Antonym|समानार्थी|विलोमार्थी)[^)]*\)/gi, '').trim();
    const correctLineEnglish = `${correctOption} (${categoryLabel}) – ${cleanCorrectEng}`;
    combinedEnglishText = `${targetLineEnglish}\n• ${correctLineEnglish}`;
  }

  let combinedHindiText = targetLineHindi;
  if (isDistinctCorrect && correctOption && correctHindi) {
    const cleanCorrectHin = correctHindi.replace(/\((?:Synonym|Antonym|समानार्थी|विलोमार्थी)[^)]*\)/gi, '').trim();
    const correctLineHindi = `${correctOption} (${categoryLabelHindi}): ${cleanCorrectHin}`;
    combinedHindiText = `${targetLineHindi}\n• ${correctLineHindi}`;
  }

  return {
    targetWord: cleanTargetDisplay,
    targetMeaning,
    targetHindi,
    targetLabel,
    correctOption: isDistinctCorrect ? correctOption : undefined,
    correctMeaning: isDistinctCorrect ? correctMeaning : undefined,
    correctHindi: isDistinctCorrect ? correctHindi : undefined,
    categoryLabel: isDistinctCorrect ? categoryLabel : undefined,
    combinedEnglishText,
    combinedHindiText,
  };
}

/**
 * Resolves or synthesizes complete educational fields (meaning, hindiMeaning, mnemonic, exampleSentence)
 * for ANY question in the application. Guarantees non-empty, high-yield content.
 */
export function resolveCardEducation(question: Question): CardEducation {
  if (!question) {
    return {
      meaning: 'Standard examination vocabulary requirement.',
      hindiMeaning: 'प्रतियोगी परीक्षा हेतु महत्वपूर्ण शब्दार्थ',
      mnemonic: 'Memory Hook: Review this term regularly to secure full marks in the exam.',
      exampleSentence: 'This question represents high-frequency exam vocabulary.',
      meaningsBreakdown: {
        targetWord: 'Vocabulary',
        targetMeaning: 'Standard examination vocabulary requirement.',
        targetHindi: 'प्रतियोगी परीक्षा हेतु महत्वपूर्ण शब्दार्थ',
        combinedEnglishText: 'Vocabulary – Standard examination vocabulary requirement.',
        combinedHindiText: 'Vocabulary: प्रतियोगी परीक्षा हेतु महत्वपूर्ण शब्दार्थ',
      },
    };
  }

  const breakdown = resolveQuestionMeaningsBreakdown(question);
  const category: QuestionCategory = question.category || 'synonyms';
  const targetWord = breakdown.targetWord;
  const correctIdx = typeof question.correctIndex === 'number' ? question.correctIndex : 0;
  const correctOption = breakdown.correctOption || (
    Array.isArray(question.options) && question.options[correctIdx]
      ? String(question.options[correctIdx]).trim()
      : targetWord
  );

  const existingMnemonic = question.mnemonic?.trim();
  const existingExample = question.exampleSentence?.trim();
  const existingRoot = question.rootWordInfo?.trim();

  const isMnemonicValid = existingMnemonic && existingMnemonic.length > 3;
  const isExampleValid = existingExample && existingExample.length > 5 && existingExample !== '""';

  // Check dictionary lookups
  const promptLookup = lookupMasterEntry(targetWord);
  const correctLookup = lookupMasterEntry(correctOption);

  // Check OWS master data if category is one-word substitution
  let owsLookup: any = null;
  if (category === 'ows') {
    owsLookup = OWS_MASTER_EXTENDED.find(
      o => o.answer.toLowerCase() === correctOption.toLowerCase() ||
           normalizeKey(o.answer) === normalizeKey(correctOption) ||
           o.phrase.toLowerCase().includes(targetWord.toLowerCase().slice(0, 20))
    );
  }

  // Check Idioms master data if category is idioms
  let idiomLookup: any = null;
  if (category === 'idioms') {
    idiomLookup = IDIOM_MASTER_EXTENDED.find(
      idm => normalizeKey(idm.idiom) === normalizeKey(targetWord) ||
             idm.idiom.toLowerCase().includes(targetWord.toLowerCase()) ||
             targetWord.toLowerCase().includes(idm.idiom.toLowerCase())
    );
  }

  // Check optionDetails if available on question
  const correctOptionDetail = Array.isArray(question.optionDetails) && question.optionDetails[correctIdx]
    ? question.optionDetails[correctIdx]
    : null;

  // 1. RESOLVE MEMORY HACK / MNEMONIC
  let finalMnemonic = isMnemonicValid ? existingMnemonic! : '';
  if (!finalMnemonic) {
    if (owsLookup?.mnemonic) {
      finalMnemonic = owsLookup.mnemonic;
    } else if (idiomLookup?.origin) {
      finalMnemonic = `Origin Hook: ${idiomLookup.origin}`;
    } else if (promptLookup?.mnemonic) {
      finalMnemonic = promptLookup.mnemonic;
    } else if (correctLookup?.mnemonic) {
      finalMnemonic = correctLookup.mnemonic;
    } else if (correctOptionDetail?.mnemonicHook) {
      finalMnemonic = correctOptionDetail.mnemonicHook;
    } else {
      const cleanPrompt = targetWord.charAt(0).toUpperCase() + targetWord.slice(1);
      const cleanAnswer = correctOption.charAt(0).toUpperCase() + correctOption.slice(1);

      if (category === 'synonyms') {
        finalMnemonic = `Memory Hook: Connect "${cleanPrompt}" directly with "${cleanAnswer}" for instant recall in the exam hall.`;
      } else if (category === 'antonyms') {
        finalMnemonic = `Memory Hook: Visualize "${cleanPrompt}" and "${cleanAnswer}" as two opposite poles on a spectrum.`;
      } else if (category === 'ows') {
        finalMnemonic = `Memory Hook: Break down "${cleanAnswer}" to link it immediately with this description.`;
      } else if (category === 'idioms') {
        finalMnemonic = `Memory Hook: Picture the literal phrase "${cleanPrompt}" to remember its figurative meaning "${cleanAnswer}".`;
      } else {
        finalMnemonic = `Memory Hook: Associate "${cleanPrompt}" with "${cleanAnswer}".`;
      }
    }
  }

  // 2. RESOLVE EXAMPLE SENTENCE
  let finalExample = isExampleValid ? existingExample! : '';
  if (!finalExample) {
    if (owsLookup?.example) {
      finalExample = owsLookup.example;
    } else if (idiomLookup?.example) {
      finalExample = idiomLookup.example;
    } else if (promptLookup?.example) {
      finalExample = promptLookup.example;
    } else if (correctLookup?.example) {
      finalExample = correctLookup.example;
    } else if (category === 'synonyms') {
      finalExample = `In standard English usage, "${targetWord}" is accurately substituted by "${correctOption}".`;
    } else if (category === 'antonyms') {
      finalExample = `While one situation was "${targetWord}", the contrasting outcome proved completely "${correctOption}".`;
    } else if (category === 'ows') {
      finalExample = `The term "${correctOption}" precisely describes one who or that which fits this role.`;
    } else if (category === 'idioms') {
      finalExample = `He used the idiom "${targetWord}" to describe the challenging situation.`;
    } else {
      finalExample = `The word "${correctOption}" frequently appears in standard examination vocabulary papers.`;
    }
  }

  return {
    meaning: breakdown.combinedEnglishText,
    hindiMeaning: breakdown.combinedHindiText,
    mnemonic: finalMnemonic,
    exampleSentence: finalExample,
    rootWordInfo: existingRoot || promptLookup?.root || correctLookup?.root,
    meaningsBreakdown: breakdown,
  };
}

/**
 * Backfills a Question object in-place so that meaning, hindiMeaning, mnemonic, and exampleSentence
 * are guaranteed non-empty. Useful for data sanitization and local storage migrations.
 */
export function enrichQuestionWithEducation<T extends Question>(question: T): T {
  if (!question) return question;

  const edu = resolveCardEducation(question);

  return {
    ...question,
    meaning: edu.meaning,
    hindiMeaning: edu.hindiMeaning,
    mnemonic: edu.mnemonic,
    exampleSentence: edu.exampleSentence,
    rootWordInfo: question.rootWordInfo || edu.rootWordInfo,
  };
}

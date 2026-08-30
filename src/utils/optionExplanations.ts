// Dictionary & lookup engine providing precise Hindi & English meanings and mnemonic context
// for ALL options across Synonyms, Antonyms, One Word Substitutions, and Idioms.

export interface OptionDetail {
  option: string;
  hindiMeaning: string;
  englishMeaning: string;
  mnemonicHook?: string;
  isCorrect: boolean;
}

// Global vocabulary lookup bank for words, synonyms, antonyms, OWS terms, and options
const VOCAB_LOOKUP: Record<string, { hindi: string; english: string; mnemonic?: string }> = {
  // --- A ---
  'taciturn': { hindi: 'अल्पभाषी / कम बोलने वाला', english: 'Habitually silent and untalkative', mnemonic: 'Taxi turn lene par silent driver' },
  'reticent': { hindi: 'संकोची / चुप रहने वाला', english: 'Disinclined to speak readily; reserved', mnemonic: 'Re-ticket counter pe chup rehna' },
  'reserved': { hindi: 'संयमी / कम बोलने वाला', english: 'Slow to reveal emotion or opinions' },
  'untalkative': { hindi: 'कम बातूनी', english: 'Not inclined to talk much' },
  'quiet': { hindi: 'शांत', english: 'Making little or no noise' },
  'silent': { hindi: 'मूक / चुप', english: 'Not speaking or emitting noise' },
  'uncommunicative': { hindi: 'कम बातचीत करने वाला', english: 'Not inclined to talk or impart information' },
  'laconic': { hindi: 'संक्षिप्त / कम शब्दों में बोलने वाला', english: 'Using very few words to express a point', mnemonic: 'Lack of conic words' },
  'loquacious': { hindi: 'बातूनी / वाचाल', english: 'Tending to talk a great deal; verbose', mnemonic: 'Root Loq/Loc = Speak' },
  'garrulous': { hindi: 'बकवादी / बातूनी', english: 'Excessively talkative, especially on trivial matters', mnemonic: 'Girl rail me bawasir ki tarah bolti rahi' },
  'talkative': { hindi: 'बातूनी', english: 'Fond of or given to talking' },
  'voluble': { hindi: 'प्रवाहपूर्ण बोलने वाला', english: 'Speaking fluently, smoothly, or incessantly' },
  'chatty': { hindi: 'गपशप करने वाला', english: 'Readily engaging in informal talk' },
  'effusive': { hindi: 'भावुक / अति-उत्साही', english: 'Expressing feelings of gratitude or pleasure unrestrainedly' },
  'outgoing': { hindi: 'मिलनसार / बहिर्मुखी', english: 'Friendly and socially confident' },
  'mute': { hindi: 'मूक / अवाक', english: 'Refraining from speech or unable to speak' },
  'verbose': { hindi: 'शब्दाडंबरपूर्ण / बहुत अधिक शब्दों वाला', english: 'Using or expressed in more words than needed' },
  'expansive': { hindi: 'खुल कर बात करने वाला', english: 'Covering a wide range in tone or willingness to talk freely' },
  'longwinded': { hindi: 'लंबी-चौड़ी बातें करने वाला', english: 'Continuing at tedious and unnecessary length' },

  // --- E ---
  'ephemeral': { hindi: 'क्षणिक / अल्पकालिक', english: 'Lasting for a very short time', mnemonic: 'E-paper charm fades in a day' },
  'transient': { hindi: 'अस्थायी / क्षणभंगुर', english: 'Lasting only for a short time; impermanent' },
  'fleeting': { hindi: 'क्षणिक / जल्दी बीतने वाला', english: 'Lasting for a very brief duration' },
  'evanescent': { hindi: 'गायब हो जाने वाला / भाप जैसा', english: 'Quickly fading or disappearing from memory' },
  'momentary': { hindi: 'पल भर का', english: 'Lasting for a very short time' },
  'shortlived': { hindi: 'अल्पजीवी', english: 'Living or lasting only a brief time' },
  'brief': { hindi: 'संक्षिप्त / छोटा', english: 'Of short duration; concise in expression' },
  'fugacious': { hindi: 'नश्वर / गायब होने वाला', english: 'Fleeting, transitory, or disappearing quickly' },
  'eternal': { hindi: 'शाश्वत / सनातन', english: 'Lasting or existing forever without end' },
  'perpetual': { hindi: 'लगातार / निरंतर', english: 'Never ending or changing; occurring repeatedly' },
  'permanent': { hindi: 'स्थायी', english: 'Lasting or intended to last indefinitely' },
  'everlasting': { hindi: 'सदा रहने वाला', english: 'Lasting forever or a very long time' },
  'enduring': { hindi: 'दीर्घकालिक / टिकने वाला', english: 'Continuing or long-lasting' },
  'immortal': { hindi: 'अमर', english: 'Living forever; never dying or decaying' },
  'persistent': { hindi: 'दृढ़ / लगातार बना रहने वाला', english: 'Continuing firmly in a course of action' },

  // --- M ---
  'meticulous': { hindi: 'अति-सावधान / बारीक काम करने वाला', english: 'Showing great attention to detail; very careful', mnemonic: 'Mitti ka hisab calculator se' },
  'fastidious': { hindi: 'तुनकमिजाज / जिसे खुश करना कठिन हो', english: 'Very attentive to and concerned about accuracy and detail', mnemonic: 'Fastidious = Fast/nakchadhi' },
  'scrupulous': { hindi: 'कर्तव्यनिष्ठ / ईमानदार व सावधान', english: 'Diligent, thorough, and extremely attentive to details' },
  'painstaking': { hindi: 'कठिन परिश्रम से किया गया', english: 'Done with or employing great care and thoroughness' },
  'punctilious': { hindi: 'नियमों का कड़ाई से पालन करने वाला', english: 'Showing great attention to conduct or correct behavior' },
  'methodical': { hindi: 'व्यवस्थित / क्रमिक', english: 'Done according to a systematic or established form' },
  'thorough': { hindi: 'पूरी तरह से / विस्तृत', english: 'Complete with regard to every detail' },
  'exact': { hindi: 'सटीक / बिल्कुल सही', english: 'Not approximated in any way; precise' },
  'careless': { hindi: 'लापरवाह', english: 'Not giving sufficient attention or thought' },
  'sloppy': { hindi: 'फूहड़ / मैला-कुचैला / लापरवाह', english: 'Careless and unsystematic; excessively casual' },
  'negligent': { hindi: 'उपेक्षापूर्ण / असावधान', english: 'Failing to take proper care in doing something' },
  'slapdash': { hindi: 'जल्दबाजी और लापरवाही से किया गया', english: 'Done too hurriedly and carelessly' },
  'heedless': { hindi: 'ध्यान न देने वाला / बेपरवाह', english: 'Showing a reckless lack of care or attention' },
  'imprecise': { hindi: 'अस्पष्ट / गैर-सटीक', english: 'Lacking exactness and accuracy of detail' },
  'slipshod': { hindi: 'लापरवाह / बेतरतीब', english: 'Characterized by a lack of care, thought, or organization' },

  // --- S ---
  'sanguine': { hindi: 'आशावादी / प्रफुल्लित', english: 'Optimistic or positive, especially in bad situations', mnemonic: 'Sang-Win = We will win together' },
  'optimistic': { hindi: 'आशावादी', english: 'Hopeful and confident about the future' },
  'hopeful': { hindi: 'उम्मीद से भरा', english: 'Feeling or inspiring optimism about a future event' },
  'confident': { hindi: 'आत्मविश्वासी', english: 'Feeling or showing certainty about something' },
  'buoyant': { hindi: 'प्रसन्नचित्त / तैरने में सक्षम', english: 'Cheerful and optimistic; able to stay afloat' },
  'positive': { hindi: 'सकारात्मक', english: 'Constructive, optimistic, or confident' },
  'cheerful': { hindi: 'हंसमुख / खुशदिल', english: 'Noticeably happy and optimistic' },
  'upbeat': { hindi: 'उत्साही / सकारात्मक', english: 'Cheerful; optimistic' },
  'pessimistic': { hindi: 'निराशावादी', english: 'Tending to see the worst aspect of things' },
  'gloomy': { hindi: 'उदास / अंधकारमय', english: 'Causing or feeling depression or despondency' },
  'despondent': { hindi: 'हताश / निराश', english: 'In low spirits from loss of hope or courage' },
  'morose': { hindi: 'चिड़चिड़ा / उदास', english: 'Sullen and ill-tempered' },
  'dour': { hindi: 'रूखा / कठोर', english: 'Relentlessly severe, stern, or gloomy in manner' },
  'defeatist': { hindi: 'हार मानने की प्रवृत्ति वाला', english: 'Demonstrating expectation or acceptance of failure' },
  'melancholic': { hindi: 'गहन उदास / विषादग्रस्त', english: 'Feeling or expressing pensive sadness' },

  // --- A ---
  'ameliorate': { hindi: 'सुधारना / बेहतर बनाना', english: 'Make something bad or unsatisfactory better', mnemonic: 'Imli rate badha ke reform karna' },
  'improve': { hindi: 'सुधार करना', english: 'Make or become better' },
  'enhance': { hindi: 'बढ़ाना / निखारना', english: 'Intensify, increase, or further improve quality' },
  'mitigate': { hindi: 'कम करना / शांत करना', english: 'Make less severe, serious, or painful' },
  'upgrade': { hindi: 'उन्नत करना', english: 'Raise something to a higher standard' },
  'better': { hindi: 'बेहतर बनाना', english: 'Improve on or surpass' },
  'refine': { hindi: 'परिष्कृत करना / शुद्ध करना', english: 'Remove impurities or unwanted elements; polish' },
  'alleviate': { hindi: 'कष्ट या पीड़ा कम करना', english: 'Make suffering or deficiency less severe' },
  'worsen': { hindi: 'और खराब होना', english: 'Make or become worse' },
  'aggravate': { hindi: 'भड़काना / स्थिति बिगाड़ना', english: 'Make a problem, injury, or offense worse or more serious' },
  'deteriorate': { hindi: 'बिगड़ना / क्षीण होना', english: 'Become progressively worse' },
  'exacerbate': { hindi: 'तीव्र करना / बदतर बनाना', english: 'Make a problem or bad feeling worse' },
  'damage': { hindi: 'नुकसान पहुंचाना', english: 'Inflict physical harm on something so as to impair value' },
  'impair': { hindi: 'हानि पहुंचाना / कमजोर करना', english: 'Weaken or damage something' },
  'decline': { hindi: 'पतन होना / गिरावट आना', english: 'Diminish in strength or quality; deteriorate' },

  // --- P ---
  'prosaic': { hindi: 'साधारण / नीरस / बिना नवीनता का', english: 'Lacking poetic beauty; unromantic or commonplace', mnemonic: 'Prose vs Poetry' },
  'mundane': { hindi: 'सांसारिक / साधारण', english: 'Lacking interest or excitement; dull' },
  'ordinary': { hindi: 'सामान्य', english: 'With no special or distinctive features; normal' },
  'pedestrian': { hindi: 'नीरस / साधारण', english: 'Lacking inspiration or excitement; dull' },
  'humdrum': { hindi: 'फीका / नीरस', english: 'Lacking excitement or variety; dull' },
  'banal': { hindi: 'तुच्छ / घिसा-पिटा', english: 'So lacking in originality as to be obvious and boring' },
  'uninspired': { hindi: 'अनाकर्षक / बिना प्रेरणा का', english: 'Lacking in imagination or originality' },
  'workaday': { hindi: 'दैनिक कामकाज का / सामान्य', english: 'Not unusual or exciting; ordinary' },
  'extraordinary': { hindi: 'असाधारण / अद्भुत', english: 'Very unusual or remarkable' },
  'poetic': { hindi: 'काव्यात्मक / सुंदर', english: 'Having an imaginative or sensitively emotional style' },
  'exciting': { hindi: 'रोमांचक', english: 'Causing great enthusiasm and eagerness' },
  'inspiring': { hindi: 'प्रेरणादायक', english: 'Having the effect of inspiring someone' },
  'imaginative': { hindi: 'कल्पनाशील', english: 'Having or showing creativity or inventiveness' },
  'fascinating': { hindi: 'मनमोहक / आकर्षक', english: 'Extremely interesting or captivating' },
  'vivid': { hindi: 'जीवंत / स्पष्ट', english: 'Producing powerful feelings or strong, clear images' },

  // --- Z ---
  'zealot': { hindi: 'कट्टरपंथी / उत्साही अनुयायी', english: 'A person fanatical in pursuit of religious or political ideals', mnemonic: 'Zeal (extreme energy) se bhara person' },
  'fanatic': { hindi: 'कट्टरपंथी', english: 'A person filled with excessive and single-minded zeal' },
  'extremist': { hindi: 'चरमपंथी', english: 'A person who holds extreme political or religious views' },
  'militant': { hindi: 'लड़ाकू / आक्रामक समर्थक', english: 'Combative and aggressive in support of a political cause' },
  'partisan': { hindi: 'पक्षपाती / कट्टर समर्थक', english: 'A strong supporter of a party, cause, or person' },
  'dogmatist': { hindi: 'हठधर्मी / सिद्धांतवादी', english: 'A person who states opinions aggressively as truth' },
  'diehard': { hindi: 'कट्टर / न झुकने वाला', english: 'A person who strongly opposes change and holds beliefs' },
  'devotee': { hindi: 'भक्त / अनन्य प्रशंसक', english: 'A person very interested in or enthusiastic about someone' },
  'moderate': { hindi: 'मध्यममार्गी / नरमपंथी', english: 'A person who holds moderate views in politics' },
  'liberal': { hindi: 'उदारवादी', english: 'Willing to respect or accept behavior different from one’s own' },
  'nonpartisan': { hindi: 'गैर-पक्षपाती', english: 'Not biased or partisan, especially toward any political group' },
  'tolerant': { hindi: 'सहनशील', english: 'Showing willingness to allow the existence of different opinions' },
  'apathetic': { hindi: 'उदासीन / बेपरवाह', english: 'Showing or feeling no interest, enthusiasm, or concern' },
  'indifferent': { hindi: 'तटस्थ / बेपरवाह', english: 'Having no particular interest or sympathy; unconcerned' },
  'neutral': { hindi: 'निष्पक्ष / तटस्थ', english: 'Not supporting or helping either side in a conflict' },

  // --- U ---
  'ubiquitous': { hindi: 'सर्वव्यापी / हर जगह मौजूद', english: 'Present, appearing, or found everywhere', mnemonic: 'Ubiquitous mosquitoes in monsoon' },
  'omnipresent': { hindi: 'सर्वत्र विद्यमान', english: 'Widely or constantly encountered; widespread' },
  'pervasive': { hindi: 'व्यापक / फैलने वाला', english: 'Spreading widely throughout an area or population' },
  'prevalent': { hindi: 'प्रचलित / व्यापक', english: 'Widespread in a particular area or at a particular time' },
  'universal': { hindi: 'सार्वभौमिक', english: 'Applicable to all cases or affecting everyone' },
  'everywhere': { hindi: 'हर जगह', english: 'In or to all places' },
  'allover': { hindi: 'सर्वत्र', english: 'Everywhere in a particular area' },
  'widespread': { hindi: 'दूर-दूर तक फैला हुआ', english: 'Found or distributed over a large area' },
  'rare': { hindi: 'दुर्लभ / विरल', english: 'Not occurring very often; uncommon' },
  'scarce': { hindi: 'अल्प / दुर्लभ', english: 'Insufficient for the demand; scarce resources' },
  'infrequent': { hindi: 'यदा-कदा होने वाला', english: 'Not occurring often; rare' },
  'uncommon': { hindi: 'असामान्य / विरला', english: 'Out of the ordinary; unusual' },
  'isolated': { hindi: 'अलग-थलग', english: 'Far away from other places, buildings, or people' },
  'seldom': { hindi: 'कभी-कभार', english: 'Not often; rarely' },
  'absent': { hindi: 'अनुपस्थित', english: 'Not present in a place, at an occasion, or as part of something' },

  // --- I ---
  'indolent': { hindi: 'आलसी / कामचोर', english: 'Wanting to avoid activity or exertion; lazy', mnemonic: 'In-Doli: Doli me baithne wala lazy insaan' },
  'slothful': { hindi: 'सुस्त / मंद', english: 'Lazy; sluggish' },
  'lazy': { hindi: 'आलसी', english: 'Unwilling to work or use energy' },
  'lethargic': { hindi: 'सुस्त / शिथिल', english: 'Affected by lethargy; sluggish and apathetic' },
  'inactive': { hindi: 'निष्क्रिय', english: 'Not engaging in or involving any or much physical activity' },
  'sluggish': { hindi: 'धीमा / सुस्त', english: 'Slow-moving or inactive' },
  'idle': { hindi: 'बेकार / निठल्ला', english: 'Without purpose or effect; pointless; lazy' },
  'torpid': { hindi: 'सुप्त / निश्चेष्ट', english: 'Mentally or physically inactive; lethargic' },
  'diligent': { hindi: 'परिश्रमी / कर्मठ', english: 'Having or showing care and conscientiousness in work' },
  'industrious': { hindi: 'मेहनती / उद्यमशील', english: 'Diligent and hard-working' },
  'active': { hindi: 'सक्रिय', english: 'Engaging or ready to engage in physically energetic pursuits' },
  'energetic': { hindi: 'ऊर्जावान', english: 'Showing or involving great activity or vitality' },
  'hardworking': { hindi: 'कठिन परिश्रमी', english: 'Constantly, regularly, or habitually working hard' },
  'assiduous': { hindi: 'अध्यवसायी / निरंतर परिश्रमी', english: 'Showing great care and perseverance' },
  'dynamic': { hindi: 'गतिशील / ऊर्जावान', english: 'Characterized by constant change, activity, or progress' },

  // --- C ---
  'capricious': { hindi: 'मनमौजी / अप्रत्याशित', english: 'Given to sudden and unaccountable changes of mood', mnemonic: 'Capri pehan ke achanak mood badalna' },
  'whimsical': { hindi: 'अनोखा / मनमौजी', english: 'Playfully quaint or fanciful; unpredictable' },
  'fickle': { hindi: 'चंचल / अस्थिर', english: 'Changing frequently, especially in regards to loyalties' },
  'impulsive': { hindi: 'आवेगी / बिना सोचे काम करने वाला', english: 'Acting or done without forethought' },
  'mercurial': { hindi: 'परिवर्तनशील / पारे जैसा', english: 'Subject to sudden or unpredictable changes of mood' },
  'erratic': { hindi: 'अनियमित / भटकने वाला', english: 'Not even or regular in pattern or movement' },
  'unpredictable': { hindi: 'अनपेक्षित / अप्रत्याशित', english: 'Not able to be predicted; changeable' },
  'volatile': { hindi: 'परिवर्तनशील / विस्फोटक', english: 'Liable to change rapidly and unpredictably' },
  'steadfast': { hindi: 'अटल / दृढ़', english: 'Resolutely or dutifully firm and unwavering' },
  'consistent': { hindi: 'सुसंगत / एक समान', english: 'Acting or done in the same way over time' },
  'stable': { hindi: 'स्थिर / सुदृढ़', english: 'Not likely to change or fail; firmly established' },
  'reliable': { hindi: 'भरोसेमंद', english: 'Consistently good in quality or performance; able to be trusted' },
  'constant': { hindi: 'निरंतर / स्थिर', english: 'Occurring continuously over a period of time' },
  'resolute': { hindi: 'दृढ़निश्चयी', english: 'Admirably purposeful, determined, and unwavering' },

  // --- P ---
  'pernicious': { hindi: 'घातक / विनाशकारी', english: 'Having a harmful effect, especially in a gradual way', mnemonic: 'Par-Nasha youth ke liye deadly' },
  'destructive': { hindi: 'विनाशकारी', english: 'Causing great and irreparable harm or damage' },
  'harmful': { hindi: 'हानिकारक', english: 'Causing or likely to cause harm' },
  'detrimental': { hindi: 'अहितकर / हानिकारक', english: 'Tending to cause harm' },
  'injurious': { hindi: 'हानिकारक / चोट पहुंचाने वाला', english: 'Causing or likely to cause damage or harm' },
  'adverse': { hindi: 'प्रतिकूल / हानिकारक', english: 'Preventing success or development; harmful' },
  'beneficial': { hindi: 'लाभकारी / हितकारी', english: 'Favorable or advantageous; resulting in good' },
  'salutary': { hindi: 'कल्याणकारी / स्वास्थ्यवर्धक', english: 'Producing good effects; beneficial' },
  'harmless': { hindi: 'अहानिकर / सीधा', english: 'Not able or likely to cause harm' },
  'advantageous': { hindi: 'फायदेमंद', english: 'Involving or creating favorable circumstances' },

  // --- A ---
  'alacrity': { hindi: 'तत्परता / फुर्ती', english: 'Brisk and cheerful readiness', mnemonic: 'A-la-carte: Order aate hi waiter me alacrity/speed' },
  'eagerness': { hindi: 'उत्सुकता', english: 'Enthusiasm to do or to have something; keenness' },
  'briskness': { hindi: 'फुर्तीलापन', english: 'Quick and active; lively or fast-paced' },
  'readiness': { hindi: 'तैयारी / तत्परता', english: 'Willingness or a state of being fully prepared' },
  'enthusiasm': { hindi: 'उत्साह / उमंग', english: 'Intense and eager enjoyment, interest, or approval' },
  'swiftness': { hindi: 'तेजी / फुर्ती', english: 'The quality of moving with great speed' },
  'speed': { hindi: 'गति / चाल', english: 'The rate at which someone or something moves' },
  'promptness': { hindi: 'समय की पाबंदी / तत्परता', english: 'The characteristic of doing something quickly and on time' },
  'reluctance': { hindi: 'अनिच्छा / हिचकिचाहट', english: 'Unwillingness or disinclination to do something' },
  'hesitation': { hindi: 'संकोच / झिझक', english: 'The action of pausing or hesitating before saying something' },
  'slowness': { hindi: 'धीमापन', english: 'The quality of lacking speed' },
  'apathy': { hindi: 'उदासीनता', english: 'Lack of interest, enthusiasm, or concern' },
  'lethargy': { hindi: 'आलस / शिथिलता', english: 'A lack of energy and enthusiasm' },
  'delay': { hindi: 'देरी / विलंब', english: 'A period of time by which something is late or postponed' },

  // --- E ---
  'esoteric': { hindi: 'गूढ़ / केवल विशेषज्ञों द्वारा समझा जाने वाला', english: 'Intended for or likely to be understood by only a small number', mnemonic: '100 logo me se sirf 10 ko samajh aane wala' },
  'obscure': { hindi: 'अस्पष्ट / अनजान', english: 'Not discovered or known about; uncertain' },
  'arcane': { hindi: 'रहस्यमय / गुप्त', english: 'Understood by few; mysterious or secret' },
  'abstruse': { hindi: 'गूढ़ / समझने में कठिन', english: 'Difficult to understand; obscure' },
  'recondite': { hindi: 'गहन / कठिन', english: 'Little known; abstruse' },
  'cryptic': { hindi: 'गुप्त / रहस्यमय', english: 'Having a meaning that is mysterious or obscure' },
  'secret': { hindi: 'गुप्त / गोपनीय', english: 'Not known or seen by others' },
  'mysterious': { hindi: 'रहस्यमयी', english: 'Difficult or impossible to understand or explain' },
  'exoteric': { hindi: 'सार्वजनिक / आम लोगों के समझने योग्य', english: 'Suitable to be imparted to the public; intelligible' },
  'familiar': { hindi: 'परिचित', english: 'Well known from long or close association' },
  'common': { hindi: 'सामान्य', english: 'Occurring, found, or done often; prevalent' },
  'obvious': { hindi: 'स्पष्ट / प्रत्यक्ष', english: 'Easily perceived or understood; clear' },
  'clear': { hindi: 'साफ / सुस्पष्ट', english: 'Easy to perceive, understand, or interpret' },
  'public': { hindi: 'सार्वजनिक', english: 'Concerning the people as a whole' },
  'simple': { hindi: 'सरल', english: 'Easily understood or done; presenting no difficulty' },

  // --- C ---
  'cacophony': { hindi: 'कर्कश ध्वनि / बेसुरी आवाज', english: 'A harsh discordant mixture of sounds', mnemonic: 'Cuckoo vs Crow: Kaa-Kaa phone me shore' },
  'dissonance': { hindi: 'विसंगति / बेसुरापन', english: 'Lack of harmony among musical notes; tension' },
  'discord': { hindi: 'कलह / बेसुरापन', english: 'Disagreement between people; harsh noise' },
  'clamor': { hindi: 'कोलाहल / शोरगुल', english: 'A loud and confused noise, especially that of people shouting' },
  'racket': { hindi: 'हंगामा / शोर', english: 'A loud unpleasant noise; a din' },
  'harshness': { hindi: 'कर्कशता', english: 'The quality of being unpleasant and severe' },
  'noise': { hindi: 'शोर / ध्वनि', english: 'A sound, especially one that is loud, unpleasant or that causes disturbance' },
  'din': { hindi: 'लगातार शोर', english: 'A loud, unpleasant, and prolonged noise' },
  'euphony': { hindi: 'मधुर ध्वनि / कर्णप्रिय आवाज', english: 'The quality of being pleasing to the ear' },
  'harmony': { hindi: 'सामंजस्य / तालमेल', english: 'The combination of simultaneously sounded musical notes' },
  'melody': { hindi: 'मधुर धुन', english: 'A sequence of single notes that is musically satisfying' },
  'symphony': { hindi: 'स्वरसंगति / सुरीली रचना', english: 'An elaborate musical composition for full orchestra' },
  'tunefulness': { hindi: 'सुरीलापन', english: 'Having a pleasing tune or melodic flow' },
  'music': { hindi: 'संगीत', english: 'Vocal or instrumental sounds combined in such a way as to produce beauty' },
  'peace': { hindi: 'शांति', english: 'Freedom from disturbance; tranquility' },

  // --- N ---
  'nadir': { hindi: 'निम्नतम स्तर / पतन', english: 'The lowest point in the fortunes of a person/institution', mnemonic: 'Nadir Shah plundered to bottom' },
  'bottom': { hindi: 'तल / निचला भाग', english: 'The lowest point or part' },
  'base': { hindi: 'आधार / नींव', english: 'The lowest part or foundation of something' },
  'depression': { hindi: 'गड्ढा / अवसाद', english: 'A sunken place or feeling of severe despondency' },
  'lowestpoint': { hindi: 'सबसे निचला स्तर', english: 'The lowest level or bottom position' },
  'abyss': { hindi: 'अथाह खाई / गहरा गर्त', english: 'A deep or seemingly bottomless chasm' },
  'trough': { hindi: 'गर्त / निम्न स्तर', english: 'A low point in a regular series of high and low points' },
  'zenith': { hindi: 'शीर्ष बिंदु / पराकाष्ठा', english: 'The time at which something is most powerful or successful', mnemonic: 'Zenith peak' },
  'apex': { hindi: 'शिखर / चोटी', english: 'The top or highest part of something, especially forming a point' },
  'pinnacle': { hindi: 'शिखर / उच्चतम स्तर', english: 'The most successful point; the culmination' },
  'acme': { hindi: 'चरमोत्कर्ष', english: 'The point at which someone or something is best, perfect' },
  'summit': { hindi: 'शिखर सम्मेलन / पर्वत चोटी', english: 'The highest point of a hill or mountain; highest level' },
  'peak': { hindi: 'चोटी / शिखर', english: 'The pointed top of a mountain; highest level' },
  'culmination': { hindi: 'चरम परिणति', english: 'The highest or climactic point of something, reached after long effort' },

  // --- A ---
  'abstain': { hindi: 'परहेज करना / दूर रहना', english: 'Restrain oneself from doing or enjoying something', mnemonic: 'Abs-tain: Six pack abs ke liye junk food abstain karna' },
  'refrain': { hindi: 'बचना / रुकना', english: 'Stop oneself from doing something' },
  'withhold': { hindi: 'रोक कर रखना', english: 'Refuse to give (something that is due to or is desired by another)' },
  'desist': { hindi: 'बंद करना / रुकना', english: 'Cease; abstain' },
  'avoid': { hindi: 'टालना / बचना', english: 'Keep away from or stop oneself from doing' },
  'forbear': { hindi: 'धैर्य रखना / दूर रहना', english: 'Politely or patiently restrain an impulse to do something' },
  'cease': { hindi: 'समाप्त करना / रुकना', english: 'Bring or come to an end' },
  'indulge': { hindi: 'लिप्त होना / मनमानी करना', english: 'Allow oneself to enjoy the pleasure of' },
  'partake': { hindi: 'भाग लेना / उपभोग करना', english: 'Join in an activity or be involved' },
  'consume': { hindi: 'खपत करना / खाना-पीना', english: 'Eat, drink, or ingest (food or drink)' },
  'embrace': { hindi: 'गले लगाना / स्वीकार करना', english: 'Accept or support a belief, theory, or change willingly' },
  'engage': { hindi: 'संलग्न होना', english: 'Participate or become involved in' },
  'pursue': { hindi: 'पीछा करना / आगे बढ़ना', english: 'Follow in order to catch or achieve' },

  // --- S ---
  'surreptitious': { hindi: 'गुप्त / चोरी-छिपे किया गया', english: 'Kept secret, especially because it would not be approved of', mnemonic: 'Sir-Rep-Tit-Ious: Sir se chhup kar reptilian sneak karna' },
  'clandestine': { hindi: 'गुप्त / अवैध रूप से छिपा हुआ', english: 'Kept secret or done secretively, especially because illicit' },
  'secretive': { hindi: 'रहस्यमय / बातें छिपाने वाला', english: 'Inclined to conceal feelings and intentions or not to disclose info' },
  'stealthy': { hindi: 'दबे पांव / गुप्त', english: 'Behaving, done, or made in a cautious and surreptitious manner' },
  'furtive': { hindi: 'चोर जैसा / छिपा हुआ', english: 'Attempting to avoid notice or attention, typically because of guilt' },
  'concealed': { hindi: 'छिपा हुआ / गुप्त', english: 'Kept secret; hidden' },
  'covert': { hindi: 'प्रच्छन्न / गुप्त', english: 'Not openly acknowledged or displayed' },
  'hidden': { hindi: 'छिपा हुआ', english: 'Kept out of sight' },
  'overt': { hindi: 'प्रत्यक्ष / खुला', english: 'Done or shown openly; plainly or readily apparent' },
  'open': { hindi: 'खुला हुआ / स्पष्ट', english: 'Allowing access, passage, or a view through an empty space' },
  'blatant': { hindi: 'खुल्लम-खुल्ला / बेशर्म', english: 'Done openly and unashamedly' },
  'frank': { hindi: 'स्पष्टवादी / खरा', english: 'Open, honest, and direct in speech or writing' },
  'transparent': { hindi: 'पारदर्शी / साफ', english: 'Easy to perceive or detect; having no secrets' },
  'candid': { hindi: 'खरा / निष्कपट', english: 'Truthful and straightforward; frank' },

  // --- O ---
  'obdurate': { hindi: 'हठी / जिद्दी / कठोर दिल', english: 'Stubbornly refusing to change one’s opinion or course of action', mnemonic: 'Ab-Dur: Door se bhi nahi maanne wala stubborn' },
  'stubborn': { hindi: 'जिद्दी / अड़ियल', english: 'Having or showing dogged determination not to change' },
  'obstinate': { hindi: 'हठी / दुराग्रही', english: 'Stubbornly refusing to change one\'s opinion or chosen action' },
  'intractable': { hindi: 'अड़ियल / जिसे संभालना कठिन हो', english: 'Hard to control or deal with' },
  'inflexible': { hindi: 'कड़ा / लचीलापन रहित', english: 'Unwilling to change or compromise' },
  'unyielding': { hindi: 'न झुकने वाला', english: 'Not giving way to pressure; hard or solid' },
  'adamant': { hindi: 'अटल / दृढ़', english: 'Refusing to be persuaded or to change one\'s mind' },
  'pigheaded': { hindi: 'मूर्खतापूर्ण जिद्दी', english: 'Stupidly obstinate' },
  'compliant': { hindi: 'आज्ञाकारी / सहमत होने वाला', english: 'Disposed to agree with others or obey rules' },
  'amenable': { hindi: 'सुझाव मानने को तैयार', english: 'Open and responsive to suggestion; easily persuaded' },
  'pliable': { hindi: 'लचीला / आसानी से प्रभावित होने वाला', english: 'Easily bent; flexible; easily influenced' },
  'yielding': { hindi: 'झुकने वाला / विनम्र', english: 'Giving way under pressure; submissive' },
  'flexible': { hindi: 'लचीला / अनुकूलनशील', english: 'Capable of bending easily without breaking; adaptable' },
  'submissive': { hindi: 'दब्बू / आज्ञाकारी', english: 'Ready to conform to the authority or will of others' },
  'tractable': { hindi: 'आसानी से नियंत्रित होने वाला', english: 'Easy to control or influence' },

  // --- B ---
  'belligerent': { hindi: 'युद्धरत / लड़ाकू / आक्रामक', english: 'Hostile and aggressive; ready for conflict', mnemonic: 'Billi-Gira-Raat: Billi jhagda karne par utaru' },
  'hostile': { hindi: 'शत्रुतापूर्ण / विरोधी', english: 'Unfriendly; antagonistic' },
  'aggressive': { hindi: 'आक्रामक', english: 'Ready or likely to attack or confront' },
  'combative': { hindi: 'लड़ाकू', english: 'Ready or inclined to fight' },
  'pugnacious': { hindi: 'झगड़ालू / मुक्केबाज जैसा', english: 'Eager or quick to argue, quarrel, or fight' },
  'quarrelsome': { hindi: 'झगड़ालू', english: 'Given to or characterized by quarreling' },
  'antagonistic': { hindi: 'विरोधी / शत्रुतापूर्ण', english: 'Showing or feeling active opposition or hostility' },
  'bellicose': { hindi: 'लड़ाकू / युद्धप्रिय', english: 'Demonstrating aggression and willingness to fight' },
  'peaceable': { hindi: 'शांतिप्रिय', english: 'Inclined to avoid conflict; peace-loving' },
  'friendly': { hindi: 'मित्रवत / स्नेही', english: 'Kind and pleasant' },
  'amicable': { hindi: 'मैत्रीपूर्ण / सौहार्दपूर्ण', english: 'Having a spirit of friendliness; without serious disagreement' },
  'pacific': { hindi: 'शांत / सुलह कराने वाला', english: 'Peaceful in character or intent' },
  'gentle': { hindi: 'विनम्र / सज्जन', english: 'Having or showing a mild, kind, or tender temperament' },
  'concordant': { hindi: 'एकमत / सामंजस्यपूर्ण', english: 'In agreement; consistent' },
  'harmonious': { hindi: 'सौहार्दपूर्ण / सुसंगत', english: 'Tuneful; not discordant; forming a pleasing whole' },

  // --- M ---
  'munificent': { hindi: 'उदार / दानवीर / मुक्तहस्त', english: 'Larger or more generous than is usual or necessary', mnemonic: 'Muni-Fe-Cent: Muni ji ne sabko daan diya' },
  'generous': { hindi: 'उदार / दानी', english: 'Showing a readiness to give more of something' },
  'bountiful': { hindi: 'प्रचुर / प्रचुरता से देने वाला', english: 'Large in quantity; giving generously' },
  'lavish': { hindi: 'भव्य / फिजूलखर्च / प्रचुर', english: 'Sumptuously rich, elaborate, or luxurious' },
  'magnanimous': { hindi: 'उदारमना / महान हृदय वाला', english: 'Generous or forgiving, especially toward a rival' },
  'charitable': { hindi: 'दानशील / परोपकारी', english: 'Pertaining to the giving of money or help to needy' },
  'openhanded': { hindi: 'मुक्तहस्त / खुले दिल से खर्च करने वाला', english: 'Giving freely; generous' },
  'stingy': { hindi: 'कंजूस', english: 'Unwilling to give or spend; ungenerous' },
  'parsimonious': { hindi: 'मक्खीचूस / अत्यधिक कंजूस', english: 'Unwilling to spend money or use resources' },
  'niggardly': { hindi: 'अल्प / कंजूसी से दिया गया', english: 'Not generous; stingy' },
  'miserly': { hindi: 'कंजूसी भरा', english: 'Of or characteristic of a miser' },
  'tightfisted': { hindi: 'कंजूस / मुट्ठी बंद रखने वाला', english: 'Not willing to spend or give much money' },
  'mean': { hindi: 'तुच्छ / मतलबी / कंजूस', english: 'Unwilling to give or share things; unkind' },
  'penurious': { hindi: 'दरिद्र / अत्यधिक कंजूस', english: 'Extremely poor; poverty-stricken; parsimonious' },

  // --- L ---
  'terse': { hindi: 'संक्षिप्त और रूखा', english: 'Sparing in the use of words; abrupt' },
  'concise': { hindi: 'संक्षिप्त और सटीक', english: 'Giving a lot of information clearly and in a few words' },
  'succinct': { hindi: 'संक्षिप्त / चुस्त', english: 'Briefly and clearly expressed' },
  'pithy': { hindi: 'सारगर्भित / अर्थपूर्ण संक्षिप्त', english: 'Concise and forcefully expressive' },
  'compact': { hindi: 'सघन / संकुचित', english: 'Closely and neatly packed together' },
  'wordy': { hindi: 'शब्दाडंबरपूर्ण', english: 'Using or expressed in rather too many words' },
  'prolix': { hindi: 'विस्तृत / उबाऊ लंबा', english: 'Using or containing too many words; tediously lengthy' },
  'diffuse': { hindi: 'फैला हुआ / असंक्षिप्त', english: 'Spread out over a large area; not concentrated' },

  // --- S ---
  'sagacious': { hindi: 'बुद्धिमान / दूरदर्शी / विवेकी', english: 'Having or showing keen mental discernment and good judgment', mnemonic: 'Saag khane wale sage/rishi sagacious hote hain' },
  'wise': { hindi: 'बुद्धिमान', english: 'Having or showing experience, knowledge, and good judgment' },
  'shrewd': { hindi: 'चतुर / चालाक', english: 'Having or showing sharp powers of judgment; astute' },
  'judicious': { hindi: 'न्यायसंगत / विवेकपूर्ण', english: 'Having, showing, or done with good judgment or sense' },
  'astute': { hindi: 'कुशाग्रबुद्धि / होशियार', english: 'Having or showing an ability to accurately assess situations' },
  'discerning': { hindi: 'पारखी / सूक्ष्मदर्शी', english: 'Having or showing good judgment' },
  'perceptive': { hindi: 'संवेदनशील / तीव्र बोध वाला', english: 'Having or showing sensitive insight' },
  'intelligent': { hindi: 'बुद्धिमान', english: 'Having or showing intelligence, especially of a high level' },
  'foolish': { hindi: 'मूर्खतापूर्ण', english: 'Lacking good sense or judgment; unwise' },
  'stupid': { hindi: 'बेवकूफ', english: 'Having or showing a great lack of intelligence or common sense' },
  'silly': { hindi: 'नासमझ / बचकाना', english: 'Having or showing a lack of common sense or judgment' },
  'ignorant': { hindi: 'अनजान / अज्ञानी', english: 'Lacking knowledge or awareness in general' },
  'naive': { hindi: 'सीधा-सादा / अनुभवहीन', english: 'Showing a lack of experience, wisdom, or judgment' },
  'unwise': { hindi: 'अनुचित / नासमझी भरा', english: 'Not wise or prudent; foolish' },
  'senseless': { hindi: 'अर्थहीन / बेहोश', english: 'Lacking common sense or purpose' },

  // --- A ---
  'aberration': { hindi: 'विपथन / सामान्य से विचलन', english: 'A departure from what is normal, usual, or expected', mnemonic: 'Ab-Ration: Rationing rule se bhatak jana' },
  'anomaly': { hindi: 'विसंगति / अनियमितता', english: 'Something that deviates from what is standard, normal' },
  'deviation': { hindi: 'विचलन / भटकाव', english: 'The action of departing from an established course' },
  'divergence': { hindi: 'अलगाव / भिन्नता', english: 'The process or state of diverging' },
  'abnormality': { hindi: 'असामान्यता', english: 'An abnormal feature, characteristic, or occurrence' },
  'irregularity': { hindi: 'अनियमितता', english: 'The state or quality of being irregular' },
  'eccentricity': { hindi: 'सनक / विचित्रता', english: 'The quality of being eccentric or unconventional' },
  'normalcy': { hindi: 'सामान्यावस्था / प्रकृत अवस्था', english: 'The condition of being normal; the state of being usual' },
  'conformity': { hindi: 'अनुरूपता / नियमों का पालन', english: 'Compliance with standards, rules, or laws' },
  'regularity': { hindi: 'नियमितता', english: 'The state or quality of being regular' },
  'standard': { hindi: 'मानक', english: 'A level of quality or attainment' },
  'uniformity': { hindi: 'एकरूपता', english: 'The quality or state of being uniform' },
  'typicality': { hindi: 'प्ररूपी स्वरूप', english: 'The state of being typical or characteristic' },
  'consistency': { hindi: 'निरंतरता / संगति', english: 'Consistent behavior or treatment' },

  // --- V ---
  'vacillate': { hindi: 'डगमगाना / अनिर्णय की स्थिति में होना', english: 'Alternate or waver between different opinions or actions', mnemonic: 'Oscillate ki tarah Vacillate karna' },
  'waver': { hindi: 'हिचकिचाना / डगमगाना', english: 'Shake with a quivering motion; become unsteady' },
  'fluctuate': { hindi: 'उतार-चढ़ाव होना', english: 'Rise and fall irregularly in number or amount' },
  'dither': { hindi: 'असमंजस में रहना', english: 'Be indecisive' },
  'oscillate': { hindi: 'दोलन करना / झूलना', english: 'Move or swing back and forth at a regular speed' },
  'teeter': { hindi: 'लड़खड़ाना / डोलना', english: 'Move or balance unsteadily; sway back and forth' },
  'decide': { hindi: 'निर्णय लेना', english: 'Come to a resolution in the mind as a result of consideration' },
  'determine': { hindi: 'दृढ़ संकल्प करना', english: 'Firmly decide upon' },
  'resolve': { hindi: 'संकल्प लेना', english: 'Settle or find a solution to a problem; decide firmly' },
  'remain': { hindi: 'बने रहना', english: 'Continue to exist, especially after other parts have gone' },
  'stay': { hindi: 'ठहरना / टिकना', english: 'Remain in the same place' },
  'settle': { hindi: 'स्थिर होना / तय करना', english: 'Resolve or reach an agreement about' },

  // --- V ---
  'voracious': { hindi: 'पेटू / अतृप्त / अत्यंत उत्सुक', english: 'Wanting or devouring great quantities of food / eager', mnemonic: 'Vor/Vour = Eat (Carnivore, Herbivore). Bahut khane wala' },
  'insatiable': { hindi: 'अतृप्य / जिसे संतुष्ट न किया जा सके', english: 'Impossible to satisfy' },
  'greedy': { hindi: 'लालची', english: 'Having or showing an intense and selfish desire for wealth or food' },
  'ravenous': { hindi: 'अत्यंत भूखा / भूखों मरने जैसा', english: 'Extremely hungry' },
  'edacious': { hindi: 'खाने का लालची', english: 'Devouring or given to eating' },
  'gluttonous': { hindi: 'पेटू / अधिक खाने वाला', english: 'Excessively greedy' },
  'hungry': { hindi: 'भूखा', english: 'Feeling or displaying the need for food' },
  'rapacious': { hindi: 'अतिलोभी / झपट्टा मारने वाला', english: 'Aggressively greedy or grasping' },
  'satiated': { hindi: 'तृप्त / संतुष्ट', english: 'Satisfied to the full; sated' },
  'abstemious': { hindi: 'संयमी / कम खाने-पीने वाला', english: 'Not self-indulgent, especially when eating and drinking' },
  'content': { hindi: 'संतुष्ट', english: 'In a state of peaceful happiness' },
  'satisfied': { hindi: 'संतुष्ट', english: 'Contented; pleased' },
  'full': { hindi: 'भरा हुआ / तृप्त', english: 'Containing or holding as much or as many as possible' },
  'restrained': { hindi: 'संयमित', english: 'Characterized by reserve or moderation; unemotional' },

  // --- T ---
  'tenacious': { hindi: 'दृढ़ / लगनशील / न छोड़ने वाला', english: 'Tending to keep a firm hold of something; clinging or adhering closely', mnemonic: 'Ten-Aces: 10 ace pakad kar game na chhodna' },
  'persevering': { hindi: 'निरंतर प्रयासशील', english: 'Continuing in a course of action even in the face of difficulty' },
  'dogged': { hindi: 'हठीला / अडिग', english: 'Having or showing tenacity and grim persistence' },
  'firm': { hindi: 'दृढ़ / मजबूत', english: 'Having a solid, almost unyielding surface or structure' },
  'tough': { hindi: 'कड़ा / मजबूत', english: 'Strong enough to withstand adverse conditions or rough handling' },
  'weak': { hindi: 'कमजोर', english: 'Lacking the power to perform physically demanding tasks' },
  'surrendering': { hindi: 'आत्मसमर्पण करने वाला', english: 'Giving up or yielding to the power of another' },
  'irresolute': { hindi: 'असमंजस में / ढुलमुल', english: 'Showing or feeling hesitancy; uncertain' },
  'slack': { hindi: 'ढीला / सुस्त', english: 'Not taut or held tightly in position; loose' },
  'feeble': { hindi: 'दुर्बल / क्षीण', english: 'Lacking physical strength, especially as a result of age or illness' },

  // --- B ---
  'benevolent': { hindi: 'दयालु / परोपकारी', english: 'Well meaning and kindly', mnemonic: 'Bene (Good) + Vol (Wish) = Accha chahne wala' },
  'kind': { hindi: 'दयालु', english: 'Having or showing a friendly, generous, and considerate nature' },
  'caring': { hindi: 'देखभाल करने वाला', english: 'Displaying kindness and concern for others' },
  'compassionate': { hindi: 'सहानुभूतिपूर्ण / दयालु', english: 'Feeling or showing sympathy and concern for others' },
  'humanitarian': { hindi: 'मानवतावादी', english: 'Concerned with or seeking to promote human welfare' },
  'altruistic': { hindi: 'परोपकारी / निस्वार्थी', english: 'Showing a disinterested and selfless concern for others' },
  'kindly': { hindi: 'कृपालु', english: 'Kind, pleasant, or warm-hearted' },
  'malevolent': { hindi: 'दुर्भावनापूर्ण / दूसरों का बुरा चाहने वाला', english: 'Having or showing a wish to do evil to others' },
  'cruel': { hindi: 'क्रूर / निर्दयी', english: 'Willfully causing pain or suffering to others' },
  'spiteful': { hindi: 'ईर्ष्यालु / द्वेषपूर्ण', english: 'Showing or caused by malice' },
  'vindictive': { hindi: 'प्रतिशोधी / बदले की भावना वाला', english: 'Having or showing a strong or unreasoning desire for revenge' },
  'malicious': { hindi: 'दुर्भावनापूर्ण', english: 'Characterized by malice; intending or intended to do harm' },
  'hateful': { hindi: 'घृणास्पद', english: 'Arousing, deserving of, or filled with hatred' },

  // --- A ---
  'acrimonious': { hindi: 'कटु / कटुतापूर्ण / तीखा', english: 'Angry and bitter (typically of speech or a debate)', mnemonic: 'Acrid + Monious: Teekha aur jhagde wala relation' },
  'bitter': { hindi: 'कड़वा / कटु', english: 'Having a sharp, pungent taste or smell; filled with anger' },
  'rancorous': { hindi: 'शत्रुतापूर्ण / विद्वेषी', english: 'Characterized by bitterness or resentment' },
  'caustic': { hindi: 'जला देने वाला / चुभने वाली बात', english: 'Sarcastic in a scathing and bitter way' },
  'biting': { hindi: 'चुभने वाला / तीव्र', english: 'Harsh or cruel; cutting' },
  'acerbic': { hindi: 'खट्टा / तीखा', english: 'Sharp and forthright; tasting sour or bitter' },
  'sharp': { hindi: 'तीखा / पैना', english: 'Having a thin edge or fine point; critical' },
  'cordial': { hindi: 'हार्दिक / आत्मीय', english: 'Warm and friendly' },
  'polite': { hindi: 'विनम्र / शिष्ट', english: 'Having or showing behavior that is respectful and considerate' },

  // --- O ---
  'ostentatious': { hindi: 'दिखावटी / आडंबरपूर्ण', english: 'Characterized by vulgar or pretentious display', mnemonic: 'Os-Ten-Tatious: 10 crore ka diamond show-off karna' },
  'showy': { hindi: 'दिखावटी', english: 'Having a striking appearance or style, typically by being bright' },
  'pretentious': { hindi: 'ढोंगी / पाखंडी', english: 'Attempting to impress by affecting greater importance' },
  'flamboyant': { hindi: 'चमकीला / भड़कीला', english: 'Tending to attract attention because of exuberance or confidence' },
  'gaudy': { hindi: 'भड़कीला / घटिया चमक-दमक', english: 'Extravagantly bright or showy, typically so as to be tasteless' },
  'flashy': { hindi: 'तड़क-भड़क वाला', english: 'Ostentatiously attractive or impressive' },
  'extravagant': { hindi: 'फिजूलखर्च / अत्यधिक', english: 'Lacking restraint in spending money or using resources' },
  'brash': { hindi: 'ढीठ / दिखावटी', english: 'Self-assertive in a rude, noisy, or overbearing way' },
  'modest': { hindi: 'विनम्र / सादा', english: 'Unassuming or moderate in the estimation of one\'s abilities' },
  'unpretentious': { hindi: 'साधारण / निष्कपट', english: 'Not attempting to impress others with an appearance' },
  'humble': { hindi: 'विनम्र / दीन', english: 'Having or showing a modest or low estimate of one\'s importance' },
  'plain': { hindi: 'सादा / स्पष्ट', english: 'Not decorated or elaborate; simple or ordinary in character' },
  'understated': { hindi: 'संयमित / सादगीपूर्ण', english: 'Presented or expressed in a subtle and effective way' },

  // --- G ---
  'gregarious': { hindi: 'झुंड में रहने वाला / मिलनसार', english: 'Fond of company; sociable', mnemonic: 'Greg-Group: Group me rehna pasand karne wala' },
  'sociable': { hindi: 'मिलनसार', english: 'Willing to talk and engage in activities with other people' },
  'social': { hindi: 'सामाजिक', english: 'Relating to society or its organization' },
  'companionable': { hindi: 'मित्रवत / स्नेही', english: 'Friendly and easy to get on with' },
  'convivial': { hindi: 'उल्लसित / दावत प्रेमी', english: 'Friendly, lively, and enjoyable' },
  'clubbable': { hindi: 'मिलनसार / सभाप्रिय', english: 'Sociable and suited to belonging to a club' },
  'reclusive': { hindi: 'एकांतप्रिय / संन्यासी जैसा', english: 'Avoiding the company of other people; solitary' },
  'solitary': { hindi: 'अकेला / एकांतवासी', english: 'Done or existing alone' },
  'antisocial': { hindi: 'असामाजिक', english: 'Contrary to the laws and customs of society' },
  'hermitlike': { hindi: 'संन्यासी जैसा', english: 'Living in solitude like a hermit' },
  'aloof': { hindi: 'अलग-थलग / तटस्थ', english: 'Not friendly or forthcoming; cool and distant' },
  'introverted': { hindi: 'अंतर्मुखी', english: 'Shy, reticent, and comfortable in solitary environments' },
  'shy': { hindi: 'शर्मीला', english: 'Being reserved or having or showing nervousness' },

  // --- P ---
  'pragmatic': { hindi: 'व्यावहारिक / यथार्थवादी', english: 'Dealing with things sensibly and realistically based on practical considerations', mnemonic: 'Pragmatic = Practical' },
  'practical': { hindi: 'व्यावहारिक', english: 'Of or concerned with the actual doing or use of something' },
  'realistic': { hindi: 'यथार्थवादी', english: 'Having or showing a sensible and practical idea of what can be done' },
  'sensible': { hindi: 'समझदार / व्यावहारिक', english: 'Chosen in accordance with wisdom or prudence' },
  'hardheaded': { hindi: 'व्यावहारिक / यथार्थपरक', english: 'Practical, realistic, and not sentimental' },
  'rational': { hindi: 'तर्कसंगत / विवेकपूर्ण', english: 'Based on or in accordance with reason or logic' },
  'utilitarian': { hindi: 'उपयोगितावादी', english: 'Designed to be useful or practical rather than attractive' },
  'workable': { hindi: 'कारगर / जो काम कर सके', english: 'Able to be worked, fashioned, or manipulated' },
  'idealistic': { hindi: 'आदर्शवादी', english: 'Characterized by idealism; unrealistically aiming for perfection' },
  'impractical': { hindi: 'अव्यावहारिक', english: 'Not adapted for use or action; not sensible or realistic' },
  'unrealistic': { hindi: 'अवास्तविक', english: 'Not realistic; having a wrong idea of what is feasible' },
  'visionary': { hindi: 'दूरदर्शी / काल्पनिक', english: 'Thinking about or planning the future with imagination' },
  'quixotic': { hindi: 'काल्पनिक / अव्यावहारिक आदर्शवादी', english: 'Exceedingly idealistic; unrealistic and impractical' },
  'theoretical': { hindi: 'सैद्धांतिक', english: 'Concerned with or involving the theory of a subject' },
  'utopian': { hindi: 'रामराज्य जैसा / आदर्श लोक की कल्पना', english: 'Modeled on or aiming for a state in which everything is perfect' },

  // --- A ---
  'audacious': { hindi: 'साहसी / दुस्साहसी / ढीठ', english: 'Showing a willingness to take surprisingly bold risks', mnemonic: 'Audi Car leke stunt karna = Audacious' },
  'bold': { hindi: 'साहसी / निडर', english: 'Showing an ability to take risks; confident and courageous' },
  'daring': { hindi: 'साहसिक / जोखिम उठाने वाला', english: 'Adventurous or audaciously bold' },
  'fearless': { hindi: 'निडर / निर्भीक', english: 'Lacking fear; brave' },
  'courageous': { hindi: 'साहसी / वीर', english: 'Not deterred by danger or pain; brave' },
  'brave': { hindi: 'बहादुर', english: 'Ready to face and endure danger or pain' },
  'intrepid': { hindi: 'निडर / अदम्य', english: 'Fearless; adventurous' },
  'valiant': { hindi: 'वीर / पराक्रमी', english: 'Possessing or showing courage or determination' },
  'timid': { hindi: 'डरपोक / कायर', english: 'Showing a lack of courage or confidence; easily frightened' },
  'cowardly': { hindi: 'कायर / बुजदिल', english: 'Lacking courage' },
  'fearful': { hindi: 'भयभीत / डरा हुआ', english: 'Feeling or showing fear or anxiety' },
  'cautious': { hindi: 'सावधान / सतर्क', english: 'Careful to avoid potential problems or dangers' },
  'meek': { hindi: 'दब्बू / नम्र', english: 'Quiet, gentle, and easily imposed on; submissive' },

  // --- S ---
  'superfluous': { hindi: 'अनावश्यक / फालतू / जरूरत से ज्यादा', english: 'Unnecessary, especially through being more than enough', mnemonic: 'Super + Flow: Overflowing extra item' },
  'redundant': { hindi: 'अतिरिक्त / अनावश्यक', english: 'Not or no longer needed or useful; superfluous' },
  'excess': { hindi: 'अधिकता / अतिरिक्त', english: 'An amount of something that is more than necessary' },
  'surplus': { hindi: 'बचत / अधिशेष', english: 'An amount of something left over when requirements are met' },
  'extra': { hindi: 'अतिरिक्त', english: 'Added to an existing or usual amount or number' },
  'unnecessary': { hindi: 'अनावश्यक', english: 'Not needed' },
  'spurious': { hindi: 'नकली / जाली / अप्रमाणिक', english: 'Not being what it purports to be; false or fake', mnemonic: 'Spurious medicines = counterfeit drugs' },
  'counterfeit': { hindi: 'नकली / जाली / अप्रमाणिक', english: 'Made in exact imitation of something with intent to deceive' },
  'authentic': { hindi: 'असली / प्रामाणिक / वास्तविक', english: 'Of undisputed origin; genuine' },
  'bogus': { hindi: 'जाली / फर्जी / बनावटी', english: 'Not genuine or true; fake' },
  'arrogant': { hindi: 'घमंडी / अहंकारी / दंभी', english: 'Having an exaggerated sense of one\'s own importance or abilities' },
  'courteous': { hindi: 'विनम्र / शिष्ट / भद्र', english: 'Polite, respectful, or considerate in manner' },
  'disrespectful': { hindi: 'अनादरपूर्ण / असभ्य', english: 'Showing a lack of respect or courtesy; impolite' },
  'impudent': { hindi: 'ढीठ / गुस्ताख / निर्लज्ज', english: 'Not showing due respect for another person; impertinent' },
  'insolent': { hindi: 'बदतमीज / असभ्य / ढीठ', english: 'Showing a rude and arrogant lack of respect' },
  'scarcity': { hindi: 'कमी / अभाव / तंगी', english: 'The state of being scarce or in short supply; shortage' },
  'dearth': { hindi: 'अभाव / कमी / अकाल', english: 'A scarcity or lack of something' },
  'shortage': { hindi: 'कमी / न्यूनता', english: 'A state in which something cannot be obtained in sufficient amounts' },
  'paucity': { hindi: 'अल्पता / कमी / न्यूनता', english: 'The presence of something only in small or insufficient quantities', mnemonic: 'Paucity = Paav bhar (small quantity)' },
  'abundance': { hindi: 'प्रचुरता / अधिकता / बहुतायत', english: 'A very large quantity of something' },
  'servile': { hindi: 'गुलाम जैसा / चापलूस / दब्बू', english: 'Having or showing an excessive willingness to serve or please others' },
  'sycophantic': { hindi: 'चापलूस / खुशामदी / जी-हजूरिया', english: 'Behaving in an obsequious way in order to gain advantage' },
  'sycophant': { hindi: 'चापलूस / जी-हजूर', english: 'A person who acts obsequiously towards someone important to gain advantage' },
  'domineering': { hindi: 'दबंग / रोब जमाने वाला', english: 'Asserting one\'s will over another in an arrogant way' },
  'inattentive': { hindi: 'असावधान / ध्यान न देने वाला', english: 'Not paying attention to something' },
  'carefree': { hindi: 'निश्चिंत / बेफिक्र / तनावमुक्त', english: 'Free from anxiety or responsibility' },
  'fussy': { hindi: 'तुनकमिजाज / नखरेबाज / मीन-मेख निकालने वाला', english: 'Fastidious about one\'s needs or requirements; hard to please' },
  'irrational': { hindi: 'तर्कहीन / गैर-वाजिब / अयथार्थ', english: 'Not logical or reasonable' },
  'flawed': { hindi: 'दोषपूर्ण / त्रुटियुक्त', english: 'Having a fundamental weakness or imperfection' },
  'faultless': { hindi: 'निर्दोष / त्रुटिहीन / बेदाग', english: 'Free from defect or error; flawless' },
  'corrupt': { hindi: 'भ्रष्ट / बेईमान / दूषित', english: 'Having or showing a willingness to act dishonestly in return for money' },
  'defective': { hindi: 'दोषपूर्ण / खराब / अपूर्ण', english: 'Imperfect or faulty' },
  'impeccable': { hindi: 'त्रुटिहीन / निष्कलंक / बेदाग', english: 'In accordance with the highest standards; faultless', mnemonic: 'Im-peckable: cannot find any flaw to peck at' },
  'confusing': { hindi: 'भ्रमित करने वाला / उलझन भरा', english: 'Bewildering or perplexing; hard to comprehend' },
  'vague': { hindi: 'अस्पष्ट / अनिश्चित / धुंधला', english: 'Of uncertain, indefinite, or unclear character or meaning' },
  'lucid': { hindi: 'स्पष्ट / सुबोध / बोधगम्य', english: 'Expressed clearly; easy to understand', mnemonic: 'Lucid dream / clear light' },
  'ambrosia': { hindi: 'अमृत / देवताओं का स्वादिष्ट भोजन', english: 'The food of the gods; something with a divine flavor' },
  'equestrian': { hindi: 'घुड़सवार / घुड़सवारी संबंधी', english: 'Relating to horse riding or horseback riders' },
  'calligrapher': { hindi: 'सुलेखक / सुंदर लिखावट लिखने वाला', english: 'A person who produces decorative handwriting or lettering' },
  'apostate': { hindi: 'स्वधर्मत्यागी / धर्मभ्रष्ट / दल बदलू', english: 'A person who renounces a religious or political belief or principle' },
  'ambivalent': { hindi: 'उभयभावी / द्विविधा में पड़ा हुआ', english: 'Having mixed feelings or contradictory ideas about something' },
  'ambidextrous': { hindi: 'सव्यसाची / दोनों हाथों से समान कार्य करने वाला', english: 'Able to use the right and left hands equally well' },
  'ambiguous': { hindi: 'अनेकार्थी / अस्पष्ट / द्विअर्थी', english: 'Open to more than one interpretation; having a double meaning' },
  'amphibian': { hindi: 'उभयचर जीव (जल और थल दोनों में रहने वाला)', english: 'An animal capable of living both on land and in water' },
  'invulnerable': { hindi: 'अभेद्य / जिसे क्षति न पहुँचाई जा सके', english: 'Impossible to harm, damage, or defeat' },
  'extempore': { hindi: 'आशुभाषण / बिना पूर्व तैयारी का भाषण', english: 'Spoken or done without any advance preparation' },
  'maiden': { hindi: 'प्रथम / पहली बार दिया गया (भाषण/प्रयास)', english: 'Being or involving the first attempt or speech of its kind' },
  'eulogy': { hindi: 'प्रशंसा भाषण / स्तुति गान', english: 'A speech or piece of writing that praises someone highly, typically deceased' },
  'soliloquy': { hindi: 'स्वगत कथन / एकांत में अपने आप से बात करना', english: 'An act of speaking one\'s thoughts aloud when alone or regardless of any hearers' },
  'elocution': { hindi: 'वाक्पटुता / सुवक्ता शैली / भाषण कला', english: 'The skill of clear and expressive speech, especially of distinct pronunciation' },
  'hesitant': { hindi: 'संकोची / हिचकिचाने वाला / झिझकने वाला', english: 'Tentative, unsure, or slow in acting or speaking' },
  'accuse': { hindi: 'आरोप लगाना / दोषी ठहराना', english: 'Claim that someone has done something illegal or wrong' },
  'absolve': { hindi: 'दोषमुक्त करना / पाप या आरोप से बरी करना', english: 'Declare someone free from blame, guilt, or responsibility' },
  'implicate': { hindi: 'फंसाना / अपराध में संलिप्त दर्शाना', english: 'Show someone to be involved in a crime or wrongdoing' },
  'exonerate': { hindi: 'दोषमुक्त करना / बेदाग बरी करना', english: 'Absolve someone from blame for a fault or wrongdoing' },
  'gratuitous': { hindi: 'अकारण / मुफ्त', english: 'Uncalled for; lacking good reason; unwarranted' },
  'essential': { hindi: 'अनिवार्य / आवश्यक', english: 'Absolutely necessary; extremely important' },
  'necessary': { hindi: 'जरूरी / आवश्यक', english: 'Required to be done, achieved, or present; needed' },
  'required': { hindi: 'अपेक्षित / जरूरी', english: 'Officially compulsory, or otherwise considered essential' },
  'needed': { hindi: 'वांछित / आवश्यक', english: 'Require something because it is essential' },
  'crucial': { hindi: 'अति महत्वपूर्ण / निर्णायक', english: 'Decisive or critical, especially in the success or failure' },
  'vital': { hindi: 'महत्वपूर्ण / जीवनदायी', english: 'Absolutely necessary; essential' },
  'indispensable': { hindi: 'अपरिहार्य / जिसके बिना काम न चले', english: 'Absolutely necessary' },

  // --- K ---
  'kudos': { hindi: 'प्रशंसा / शाबाशी / सम्मान', english: 'Praise and honor received for an achievement', mnemonic: 'Kudos to you! (Well done)' },
  'praise': { hindi: 'प्रशंसा / तारीफ', english: 'Express warm approval or admiration of' },
  'honor': { hindi: 'सम्मान / आदर', english: 'High respect; great esteem' },
  'glory': { hindi: 'महिमा / यश', english: 'High renown or honor won by notable achievements' },
  'acclaim': { hindi: 'जयकार / सार्वजनिक प्रशंसा', english: 'Praise enthusiastically and publicly' },
  'applause': { hindi: 'तालियों की गड़गड़ाहट', english: 'Approval or praise expressed by clapping' },
  'compliments': { hindi: 'शुभकामनाएं / प्रशंसा', english: 'Polite expressions of praise or admiration' },
  'tribute': { hindi: 'श्रद्धांजलि / सम्मान', english: 'An act, statement, or gift intended to show gratitude' },
  'disapproval': { hindi: 'अस्वीकृति / नाराजगी', english: 'Possession or expression of an unfavorable opinion' },
  'criticism': { hindi: 'आलोचना / समीक्षा', english: 'The expression of disapproval of someone or something' },
  'blame': { hindi: 'दोष / आरोप', english: 'Feel or declare that (someone or something) is responsible for a fault' },
  'censure': { hindi: 'निंदा / कठोर आलोचना', english: 'Express severe disapproval of (someone or something)' },
  'condemnation': { hindi: 'निंदा / भर्त्सना', english: 'The expression of very strong disapproval; censure' },
  'reproach': { hindi: 'फटकार / उलाहना', english: 'Address (someone) in such a way as to express disapproval' },
  'denunciation': { hindi: 'खुली निंदा / आरोप', english: 'Public condemnation of someone or something' },

  // --- ONE WORD SUBSTITUTION MASTER DICTIONARY ---
  'somnambulist': { hindi: 'नींद में चलने वाला', english: 'A person who walks in their sleep', mnemonic: 'Somnus (Sleep) + Ambulare (Walk)' },
  'somniloquist': { hindi: 'नींद में बोलने वाला', english: 'A person who talks in their sleep', mnemonic: 'Somnus (Sleep) + Loqui (Speak)' },
  'altruist': { hindi: 'परोपकारी व्यक्ति', english: 'A person who unselfishly cares for the welfare of others' },
  'numismatist': { hindi: 'सिक्का संग्रहकर्ता / मुद्राशास्त्री', english: 'A person who collects or studies coins and tokens' },
  'philatelist': { hindi: 'डाक टिकट संग्रहकर्ता', english: 'A person who collects or studies postage stamps' },
  'misanthrope': { hindi: 'मानवद्वेषी / समाज से दूर रहने वाला', english: 'A person who dislikes humankind and avoids society' },
  'philanthropist': { hindi: 'जनहितैषी / दानवीर', english: 'A person who seeks to promote welfare of others by charity' },
  'misogynist': { hindi: 'महिला-द्वेषी', english: 'A person who hates or is strongly prejudiced against women' },
  'cannibal': { hindi: 'नरभक्षी / स्वजातिभक्षी', english: 'A person or animal that eats the flesh of its own kind' },
  'polyglot': { hindi: 'बहुभाषी / कई भाषाएं जानने वाला', english: 'A person knowing or using several languages fluently' },
  'iconoclast': { hindi: 'परंपरा भंजक / रूढ़िवादी विरोधी', english: 'A person who attacks cherished beliefs or institutions' },
  'egoist': { hindi: 'स्वार्थी / अहंवादी', english: 'A self-centered or selfish individual' },
  'egotist': { hindi: 'स्वप्रशंसक / अपनी ही डींगें हांकने वाला', english: 'A person who talks excessively about oneself' },
  'anarchist': { hindi: 'अराजकतावादी', english: 'A person who believes in or tries to bring about anarchy' },
  'fatalist': { hindi: 'भाग्यवादी / जो किस्मत पर निर्भर हो', english: 'Someone who believes that all events are predetermined by fate' },
  'orthodox': { hindi: 'रूढ़िवादी / परंपरावादी', english: 'Conforming to what is generally or traditionally accepted' },
  'inevitable': { hindi: 'अपरिहार्य / जिसे टाला न जा सके', english: 'Certain to happen; unavoidable' },
  'optional': { hindi: 'वैकल्पिक', english: 'Available to be chosen but not obligatory' },
  'uncertain': { hindi: 'अनिश्चित', english: 'Not known, reliable, or definitely decided' },
  'avoidable': { hindi: 'टालने योग्य', english: 'Able to be prevented or avoided' },
  'epicure': { hindi: 'स्वादलोलुप / उत्तम भोजन का पारखी', english: 'A person who takes particular pleasure in fine food and drink' },
  'stoic': { hindi: 'सुख-दुख में समभाव रहने वाला', english: 'A person who can endure pain or hardship without showing feelings' },
  'glutton': { hindi: 'पेटू / अधिक खाने वाला', english: 'An excessively greedy eater' },
  'ascetic': { hindi: 'तपस्वी / संन्यासी', english: 'Characterized by severe self-discipline and abstention from pleasures' },
  'hermit': { hindi: 'एकांतवासी साधु', english: 'A person living in solitude as a religious discipline' },
  'usurer': { hindi: 'सूदखोर / भारी ब्याज वसूलने वाला', english: 'A person who lends money at unreasonably high rates of interest' },
  'banker': { hindi: 'बैंकर / महाजन', english: 'An officer or owner of a bank' },
  'miser': { hindi: 'कंजूस / मक्खीचूस', english: 'A person who hoards wealth and spends as little money as possible' },
  'benefactor': { hindi: 'उपकारी / शुभचिंतक', english: 'A person who gives money or other help to a person or cause' },
  'investor': { hindi: 'निवेशक', english: 'A person or organization that puts money into financial schemes' },
  'incorrigible': { hindi: 'असंशोधनीय / जिसे सुधारा न जा सके', english: 'A person or behavior not able to be corrected or reformed' },
  'ineligible': { hindi: 'अयोग्य / अपात्र', english: 'Legally or officially unqualified' },
  'invincible': { hindi: 'अजेय / जिसे हराया न जा सके', english: 'Too powerful to be defeated or overcome' },
  'illegible': { hindi: 'अपठनीय / जो पढ़ा न जा सके', english: 'Not clear enough to be read' },
  'indelible': { hindi: 'अमिट / जो मिटाया न जा सके', english: 'Making marks that cannot be removed; permanent' },
  'panacea': { hindi: 'रामबाण औषधि / सर्वरोगहारी', english: 'A remedy or solution for all diseases or difficulties' },
  'placebo': { hindi: 'डमी दवा / मनोवैज्ञानिक संतुष्टि की औषधि', english: 'A harmless pill prescribed for psychological benefit' },
  'antibiotic': { hindi: 'जीवाणुरोधी दवा', english: 'A medicine that inhibits the growth of microorganisms' },
  'antidote': { hindi: 'विषनाशक / काट', english: 'A medicine taken or given to counteract a particular poison' },
  'elixir': { hindi: 'अमृत / जीवनदायी रस', english: 'A magical or medicinal potion capable of curing illness' },
  'archives': { hindi: 'अभिलेखागार / ऐतिहासिक दस्तावेज कक्ष', english: 'A collection of historical documents or records' },
  'archive': { hindi: 'अभिलेखागार', english: 'A collection of historical documents or records' },
  'museum': { hindi: 'संग्रहालय', english: 'A building displaying objects of historical, scientific, or artistic interest' },
  'library': { hindi: 'पुस्तकालय', english: 'A building or room containing collections of books' },
  'repository': { hindi: 'संग्रह स्थान / गोदाम', english: 'A central place in which things are stored' },
  'armory': { hindi: 'शस्त्रागार / हथियारों का डिपो', english: 'A place where weapons and military equipment are stored' },
  'sanctuary': { hindi: 'अभयारण्य / शरणस्थली', english: 'A place of refuge or safety; wildlife reserve' },
  'atheist': { hindi: 'नास्तिक / ईश्वर को न मानने वाला', english: 'A person who disbelieves or lacks belief in God' },
  'theist': { hindi: 'आस्तिक / ईश्वरवादी', english: 'A person who believes in the existence of a God or gods' },
  'agnostic': { hindi: 'अज्ञेयवादी / संशयवादी', english: 'A person who believes that nothing is known of God\'s existence' },
  'pagan': { hindi: 'मूर्तिपूजक / गैर-ईसाई', english: 'A person holding religious beliefs other than mainstream faiths' },
  'infallible': { hindi: 'अचूक / जो गलती न करे', english: 'Incapable of making mistakes or being wrong' },
  'inaudible': { hindi: 'अश्रव्य / जो सुनाई न दे', english: 'Unable to be heard' },
  'immutable': { hindi: 'अपरिवर्तनीय / न बदलने वाला', english: 'Unchanging over time or unable to be changed' },
  'linguist': { hindi: 'भाषाविद् / भाषा वैज्ञानिक', english: 'A person skilled in foreign languages or linguistics' },
  'polyandrist': { hindi: 'बहुपति रखने वाली स्त्री', english: 'A woman who has more than one husband simultaneously' },
  'polygamist': { hindi: 'बहुविवाही पुरुष या स्त्री', english: 'A person who has more than one spouse at the same time' },
  'bibliophile': { hindi: 'पुस्तक प्रेमी / किताबों का शौकीन', english: 'A person who collects or has a great love of books' },
  'amnesty': { hindi: 'सर्वक्षमा / आम माफ़ी', english: 'An official pardon for political offenses' },
  'armistice': { hindi: 'युद्धविराम / शांति समझौता', english: 'An agreement made by opposing sides to stop fighting' },
  'acquittal': { hindi: 'दोषमुक्ति / बाइज्जत बरी', english: 'A judgment that a person is not guilty of the crime' },
  'parole': { hindi: 'सशर्त रिहाई', english: 'The temporary or permanent release of a prisoner on promise of good behavior' },
  'anthropologist': { hindi: 'मानवविज्ञानी', english: 'An expert in or student of the development of human societies' },
  'archaeologist': { hindi: 'पुरातत्वविद्', english: 'A person who studies human history through excavation of sites' },
  'cartographer': { hindi: 'मानचित्रकार / नक्शानवीस', english: 'A person who draws or produces maps' },
  'florist': { hindi: 'फूल विक्रेता', english: 'A person who sells and arranges cut flowers' },
  'zoologist': { hindi: 'प्राणि विज्ञानी', english: 'An expert in or student of the behavior and anatomy of animals' },
  'bibliographer': { hindi: 'ग्रंथसूचीकार', english: 'A person who compiles bibliographies or describes books' },
  'bibliophobe': { hindi: 'पुस्तकों से डरने या नफरत करने वाला', english: 'A person who hates, fears, or distrusts books' },
  'bookworm': { hindi: 'किताबी कीड़ा', english: 'A person devoted to reading books' },
  'archivist': { hindi: 'अभिलेखापाल', english: 'A person who maintains and is in charge of archives' },
};

// Precise lookup dictionary for all standard idiom options and distractors
const IDIOM_PHRASE_LOOKUP: Record<string, { hindi: string; english: string }> = {
  'a subject or issue over which there is continuing disagreement': {
    hindi: 'झगड़े की जड़ / विवाद का मुख्य विषय',
    english: 'A controversial matter that causes ongoing dispute.'
  },
  'a great source of strength and unity': {
    hindi: 'एकजुटता और शक्ति का बड़ा स्रोत',
    english: 'A major source of collective power, harmony, and mutual support.'
  },
  'an agreement signed between two allies': {
    hindi: 'दो सहयोगियों के बीच हस्ताक्षरित शांति समझौता',
    english: 'A formal treaty or pact established between friendly nations.'
  },
  'a sudden fortunate windfall of money': {
    hindi: 'अचानक मिला अप्रत्याशित धन लाभ',
    english: 'An unexpected financial windfall or sudden stroke of good fortune.'
  },
  'to exhaust one’s energy by working excessively late and early': {
    hindi: 'देर रात तक और सुबह जल्दी अत्यधिक परिश्रम करके ऊर्जा समाप्त करना',
    english: 'To work intensely without adequate rest.'
  },
  'to waste money on luxurious home lighting': {
    hindi: 'महंगी सजावट या रोशनी पर अनावश्यक पैसे बर्बाद करना',
    english: 'To spend money recklessly on lavish home illumination.'
  },
  'to finish an exam before the allotted timer': {
    hindi: 'समय सीमा से पहले परीक्षा समाप्त करना',
    english: 'To complete a test prior to the allocated time limit.'
  },
  'to cause a major accidental fire': {
    hindi: 'अनजाने में भयंकर आगजनी का कारण बनना',
    english: 'To accidentally ignite a destructive and dangerous fire.'
  },
  'in a state of bitter hostility or readiness to fight': {
    hindi: 'कट्टर दुश्मनी होना / तलवारें खिंची होना',
    english: 'Being in a fierce dispute ready for active confrontation.'
  },
  'engaged in peaceful bilateral trade': {
    hindi: 'शांतिपूर्ण द्विपक्षीय व्यापार में संलग्न होना',
    english: 'Conducting friendly and mutually beneficial international commerce.'
  },
  'practicing traditional fencing sport': {
    hindi: 'पारंपरिक तलवारबाजी खेल का अभ्यास करना',
    english: 'Engaging in martial arts or fencing swordsmanship training.'
  },
  'sharing mutual respect and admiration': {
    hindi: 'आपसी सम्मान और प्रशंसा साझा करना',
    english: 'Holding each other in high esteem, friendship, and regard.'
  },
  'very rarely or almost never': {
    hindi: 'ईद का चांद होना / बहुत ही दुर्लभ रूप से',
    english: 'Happening on extraordinarily rare occasions.'
  },
  'every full moon cycle regularly': {
    hindi: 'हर पूर्णिमा चक्र पर नियमित रूप से',
    english: 'Taking place periodically on each lunar cycle without fail.'
  },
  'during severe oceanic tidal surges': {
    hindi: 'समुद्र में भीषण ज्वार-भाटा के समय',
    english: 'Happening during extreme high tide or coastal surge conditions.'
  },
  'frequently occurring on night shifts': {
    hindi: 'रात की पाली में बार-बार होना',
    english: 'Taking place regularly during late night duty hours.'
  },
  'to disclose a secret prematurely or indiscreetly': {
    hindi: 'भेद खोल देना / गुप्त बात समय से पहले उजागर करना',
    english: 'To reveal confidential information carelessly.'
  },
  'to drop grocery items by accident': {
    hindi: 'गलती से खाने-पीने का सामान फर्श पर गिरा देना',
    english: 'To unintentionally drop household grocery items.'
  },
  'to prepare a hot meal for guests': {
    hindi: 'अतिथियों के लिए स्वादिष्ट भोजन पकाना',
    english: 'To cook and serve a fresh warm meal for visitors.'
  },
  'to refuse cooperation with investigators': {
    hindi: 'जांच अधिकारियों को सहयोग देने से साफ मना करना',
    english: 'To actively obstruct or decline help to investigating officers.'
  },
  'by any means possible, fair or foul': {
    hindi: 'किसी भी तरह / साम-दाम-दंड-भेद से',
    english: 'Using any possible method, whether honest or deceitful.'
  },
  'through lawful and strictly ethical methods only': {
    hindi: 'केवल कानूनी और नैतिक तरीकों से',
    english: 'Using strictly authorized, legal, and honorable procedures.'
  },
  'by using professional fishing equipment': {
    hindi: 'मछली पकड़ने के पेशेवर उपकरणों का उपयोग करके',
    english: 'Employing specialized angling tackle and fishing tools.'
  },
  'by giving up under severe external pressure': {
    hindi: 'भारी बाहरी दबाव में आकर हार मान लेना',
    english: 'Surrendering or abandoning one\'s goals under distress.'
  },
  'a good thing that seemed bad at first': {
    hindi: 'दुख के भेष में सुख / छिपा हुआ वरदान',
    english: 'An unfortunate event that ultimately brings unexpected benefits.'
  },
  'a curse disguised as a lucrative offer': {
    hindi: 'आकर्षक प्रस्ताव के रूप में छिपा हुआ अभिशाप',
    english: 'A deceptive proposal that hides catastrophic long-term harm.'
  },
  'a religious celebration in village temple': {
    hindi: 'गांव के मंदिर में होने वाला धार्मिक उत्सव',
    english: 'A traditional spiritual gathering held at a community shrine.'
  },
  'a masked performer at theater': {
    hindi: 'नाट्यशाला में मुखौटा पहनकर अभिनय करने वाला कलाकार',
    english: 'An actor performing on stage behind a dramatic mask.'
  },
  'to face a difficult or unpleasant situation with courage': {
    hindi: 'मुसीबत का डटकर साहसपूर्वक सामना करना',
    english: 'To confront a harsh reality or painful challenge bravely.'
  },
  'to retaliate using firearms aggressively': {
    hindi: 'हथियारों से आक्रामक जवाबी गोलीबारी करना',
    english: 'To return military gunfire forcefully in battle.'
  },
  'to chew through metal components recklessly': {
    hindi: 'धातु के टुकड़ों को लापरवाही से चबाना',
    english: 'Literally attempting to bite through hard metallic pieces.'
  },
  'to surrender completely to the enemy': {
    hindi: 'शत्रु के समक्ष पूरी तरह आत्मसमर्पण करना',
    english: 'To yield unconditionally and lay down weapons.'
  },
  'to state a truth or describe a situation exactly right': {
    hindi: 'सटीक बात कहना / बिल्कुल सही निष्कर्ष निकालना',
    english: 'To evaluate or articulate a situation with 100% precision.'
  },
  'to cause a severe injury while using carpentry tools': {
    hindi: 'बढ़ई के औजार चलाते समय गंभीर चोट लगना',
    english: 'To suffer physical wounds accidentally with workshop equipment.'
  },
  'to make an accidental error during calculation': {
    hindi: 'गणना करते समय अनजाने में गणितीय गलती करना',
    english: 'To commit an unintended mathematical arithmetic slip.'
  },
  'to shout loudly at subordinate workers': {
    hindi: 'अधीनस्थ कर्मचारियों पर जोर से चिल्लाना',
    english: 'To berate or reprimand junior employees harshly.'
  },
  'to try every possible course of action in order to achieve something': {
    hindi: 'कोई कसर न छोड़ना / हर संभव प्रयास करना',
    english: 'To exhaust all available efforts and avenues to reach an objective.'
  },
  'to carry heavy construction boulders manually': {
    hindi: 'हाथों से भारी निर्माण पत्थर उठाना',
    english: 'To physically lift and transport heavy rocks at a construction site.'
  },
  'to neglect the key chapters during revision': {
    hindi: 'पुनरावृत्ति के दौरान मुख्य अध्यायों की उपेक्षा करना',
    english: 'To overlook high-weightage topics during exam preparation.'
  },
  'to destroy ancient historical monuments': {
    hindi: 'प्राचीन ऐतिहासिक स्मारकों को नष्ट करना',
    english: 'To vandalize and demolish irreplaceable cultural heritage sites.'
  },
  'to receive an unexpected expensive gift': {
    hindi: 'अप्रत्याशित कीमती उपहार प्राप्त करना',
    english: 'To receive a valuable present surprisingly without prior anticipation.'
  },
  'the ability to speak easily and persuasively': {
    hindi: 'वाक्पटुता / धाराप्रवाह और प्रभावशाली बोलने की अद्भुत कला',
    english: 'The talent of expressing oneself fluently, persuasively, and with charisma (Gift of the gab).'
  },
  'to talk continuously without sense': {
    hindi: 'बिना सिर-पैर के लगातार बकवास करना',
    english: 'To speak incessantly without logic or meaningful substance.'
  },
  'to possess good fortune in career': {
    hindi: 'करियर में अपार भाग्य व सफलता प्राप्त होना',
    english: 'To enjoy continuous lucky success and rapid advancement in one\'s profession.'
  },
  'at 11:00 pm at night': {
    hindi: 'रात के ठीक 11:00 बजे (घड़ी का समय)',
    english: 'Literally at 23:00 hours on the clock at night.'
  },
  'at the last possible moment': {
    hindi: 'ऐन वक्त पर / अंतिम समय में (At the eleventh hour)',
    english: 'At the very last moment just before it becomes too late or time runs out.'
  },
  'early in the morning': {
    hindi: 'सुबह-सुबह / प्रातःकाल के समय',
    english: 'During the early dawn hours of the day.'
  },
  'when everything is completed': {
    hindi: 'जब सब कुछ समाप्त या संपन्न हो चुका हो',
    english: 'After the final conclusion of all activities.'
  },
  'to waste valuable electricity': {
    hindi: 'बिजली की अनावश्यक बर्बादी करना',
    english: 'To consume electrical power needlessly.'
  },
  'to work or study late into the night': {
    hindi: 'देर रात तक कड़ी मेहनत / पढ़ाई करना (Burn the midnight oil)',
    english: 'To exert oneself tirelessly into the late night and early morning hours.'
  },
  'to cook food at night': {
    hindi: 'रात के समय भोजन पकाना',
    english: 'To prepare meals during nighttime hours.'
  },
  'to create fire accidents': {
    hindi: 'आग की दुर्घटनाएं उत्पन्न करना',
    english: 'To carelessly trigger hazardous fire outbreaks.'
  },
  'a tough food item': {
    hindi: 'एक कठोर व चबाने में मुश्किल खाद्य पदार्थ',
    english: 'A solid food item that is physically difficult to chew or digest.'
  },
  'a difficult problem or person to deal with': {
    hindi: 'लोहे के चने चबाना / अत्यंत कठिन समस्या या जिद्दी व्यक्ति (A hard nut to crack)',
    english: 'An intricate, challenging dilemma or an unyielding person who is hard to manage.'
  },
  'an easy task requiring no effort': {
    hindi: 'एक बहुत आसान काम / बच्चों का खेल (A piece of cake)',
    english: 'A simple assignment requiring minimal labor or thought.'
  },
  'a broken promise': {
    hindi: 'टूटा हुआ वादा / विश्वासघात',
    english: 'A solemn pledge or commitment that was not honored.'
  },
  'to become physically deaf': {
    hindi: 'शारीरिक रूप से बहरा हो जाना',
    english: 'To lose auditory hearing capability completely.'
  },
  'to refuse to listen or ignore deliberately': {
    hindi: 'अनसुना कर देना / जानबूझकर ध्यान न देना (Turn a deaf ear)',
    english: 'To deliberately refuse to listen, disregard warnings, or ignore advice.'
  },
  'to clean one’s ears carefully': {
    hindi: 'सावधानी से अपने कान साफ करना',
    english: 'To physically cleanse the auditory canals.'
  },
  'to listen with immense curiosity': {
    hindi: 'अत्यंत उत्सुकता व ध्यान से सुनना',
    english: 'To pay rapt attention with intense curiosity and focus.'
  },
  'under all conditions, no matter how difficult': {
    hindi: 'हर हाल में / सुख-दुख में / हर परिस्थिति में (Through thick and thin)',
    english: 'Under all circumstances, through both good times and difficult hardships.'
  },
  'in good health and sickness only': {
    hindi: 'केवल स्वास्थ्य और बीमारी के दौरान',
    english: 'Exclusively during periods of physical wellness or illness.'
  },
  'walking through dense forest': {
    hindi: 'घने जंगल से होकर गुजरना',
    english: 'Navigating physically through thick woodland and vegetation.'
  },
  'gaining and losing body weight': {
    hindi: 'शारीरिक वजन घटाना और बढ़ाना',
    english: 'Undergoing fluctuations in physical body mass and physique.'
  },
  'to build a stone monument': {
    hindi: 'पत्थर का स्मारक बनाना',
    english: 'To erect a masonry structure in tribute or remembrance.'
  },
  'to try every possible course of action to achieve a goal': {
    hindi: 'कोई कसर न छोड़ना / हर संभव प्रयास करना (Leave no stone unturned)',
    english: 'To try every possible method and exhaust all efforts to reach a goal.'
  },
  'to search for precious minerals': {
    hindi: 'कीमती खनिजों व रत्नों की खोज करना',
    english: 'To prospect for valuable geological ores and stones.'
  },
  'to leave everything unorganized': {
    hindi: 'सब कुछ अस्त-व्यस्त छोड़ देना',
    english: 'To abandon materials in complete disorder and disarray.'
  },
  'a sweet and delicious fruit': {
    hindi: 'एक मीठा और स्वादिष्ट फल',
    english: 'A succulent, edible natural fruit with pleasant taste.'
  },
  'a cause of dispute, argument, or rivalry': {
    hindi: 'झगड़े की जड़ / फसाद की जड़ (A bone of contention / Apple of discord)',
    english: 'The core subject or issue over which people quarrel, argue, or dispute.'
  },
  'a reward for good work': {
    hindi: 'सराहनीय कार्य का इनाम या पुरस्कार',
    english: 'A prize or compensation given for commendable performance.'
  },
  'a healthy habit': {
    hindi: 'एक स्वस्थ व लाभकारी आदत',
    english: 'A positive routine beneficial for physical or mental wellbeing.'
  },
  'a vulnerable or weak spot in an otherwise strong situation': {
    hindi: 'कमजोर नस / दुर्बल पक्ष (Achilles heel)',
    english: 'A critical vulnerability or weak point in an otherwise strong position.'
  }
};

export function getOptionBreakdown(
  options: string[],
  correctIndex: number,
  category: string,
  rootWord: string = '',
  questionMeaning?: string,
  questionHindiMeaning?: string
): OptionDetail[] {
  return options.map((opt, idx) => {
    const isCorrect = idx === correctIndex;
    const cleanOpt = opt.trim();
    const normalizedKey = cleanOpt.toLowerCase().replace(/[^a-z0-9]/g, '');
    const plainLower = cleanOpt.toLowerCase();

    // 1. Direct vocabulary lookup
    for (const [key, val] of Object.entries(VOCAB_LOOKUP)) {
      const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalizedKey === cleanKey || (normalizedKey.length > 3 && cleanKey === normalizedKey)) {
        return {
          option: opt,
          hindiMeaning: isCorrect && questionHindiMeaning ? `${val.hindi}` : val.hindi,
          englishMeaning: isCorrect && questionMeaning ? `${val.english}` : val.english,
          mnemonicHook: val.mnemonic,
          isCorrect,
        };
      }
    }

    // 2. Phrase / idiom lookup (exact and partial)
    for (const [phrase, meaning] of Object.entries(IDIOM_PHRASE_LOOKUP)) {
      if (plainLower.includes(phrase) || phrase.includes(plainLower) || normalizedKey === phrase.replace(/[^a-z0-9]/g, '')) {
        return {
          option: opt,
          hindiMeaning: meaning.hindi,
          englishMeaning: meaning.english,
          isCorrect,
        };
      }
    }

    // 3. Partial match in vocabulary table for words with prefixes/suffixes/variations
    for (const [key, val] of Object.entries(VOCAB_LOOKUP)) {
      if (normalizedKey.length >= 4 && (normalizedKey.startsWith(key) || key.startsWith(normalizedKey))) {
        return {
          option: opt,
          hindiMeaning: val.hindi,
          englishMeaning: val.english,
          mnemonicHook: val.mnemonic,
          isCorrect,
        };
      }
    }

    // 4. If this is the correct option and question meaning is provided, use the question's explicit meaning
    if (isCorrect) {
      if (questionHindiMeaning && questionMeaning) {
        return {
          option: opt,
          hindiMeaning: questionHindiMeaning,
          englishMeaning: questionMeaning,
          isCorrect: true,
        };
      }
      if (category === 'idioms') {
        return {
          option: opt,
          hindiMeaning: `मुहावरे का सही भावार्थ: "${cleanOpt}"`,
          englishMeaning: `Accurate figurative definition: "${cleanOpt}"`,
          isCorrect: true,
        };
      }
      return {
        option: opt,
        hindiMeaning: questionHindiMeaning || `"${cleanOpt}" का यथार्थ शब्दार्थ`,
        englishMeaning: questionMeaning || `Accurate definition corresponding to "${cleanOpt}"`,
        isCorrect: true,
      };
    }

    // 5. Clean natural meaning for distractors/options
    if (category === 'idioms') {
      return {
        option: opt,
        hindiMeaning: `शाब्दिक वाक्यांश: "${cleanOpt}"`,
        englishMeaning: `Literal context: "${cleanOpt}" (differs from the figurative sense)`,
        isCorrect: false,
      };
    }

    // Morphological & prefix derivation for distractors
    const optLower = cleanOpt.toLowerCase();
    let derivedEnglish = `Distinct vocabulary concept denoting "${cleanOpt}", serving as an exam distractor.`;
    let derivedHindi = `"${cleanOpt}" का स्वतंत्र अर्थ`;

    if (optLower.startsWith('pan')) {
      derivedEnglish = `Relates to all-encompassing, public, or universal scope (Greek pan-).`;
      derivedHindi = `सार्वजनिक / समग्र या सर्वव्यापी भाव`;
    } else if (optLower.startsWith('castig') || optLower.startsWith('chast')) {
      derivedEnglish = `To criticize, discipline, or reprimand severely (Latin castigare).`;
      derivedHindi = `कठोर आलोचना / फटकार या दंड`;
    } else if (optLower.startsWith('tribut')) {
      derivedEnglish = `An act, statement, or gift that is intended to show gratitude or respect.`;
      derivedHindi = `श्रद्धांजलि / भेंट / सम्मान`;
    } else if (optLower.startsWith('praise') || optLower.startsWith('laud') || optLower.startsWith('appl')) {
      derivedEnglish = `Expression of high approval, commendation, or admiration.`;
      derivedHindi = `प्रशंसा / स्तुति / गुणगान`;
    } else if (optLower.startsWith('critic') || optLower.startsWith('censor') || optLower.startsWith('condemn')) {
      derivedEnglish = `Expression of strong disapproval, fault-finding, or censure.`;
      derivedHindi = `निंदा / आलोचना / दोषारोपण`;
    } else if (optLower.startsWith('bene')) {
      derivedEnglish = `Denotes favorable, kind, or well-intentioned nature (Latin bene-).`;
      derivedHindi = `कल्याणकारी / हितकारी भाव`;
    } else if (optLower.startsWith('mal')) {
      derivedEnglish = `Denotes harmful, defective, or unfavorable nature (Latin mal-).`;
      derivedHindi = `हानिकारक / दुर्भावनापूर्ण भाव`;
    }

    return {
      option: opt,
      hindiMeaning: derivedHindi,
      englishMeaning: derivedEnglish,
      isCorrect: false,
    };
  });
}


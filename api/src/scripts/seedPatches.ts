/**
 * seedPatches.ts — Declarative list of seed-data patches.
 *
 * Each entry describes a schema / data change that should be applied exactly
 * once, tracked by a SeedVersion record.
 *
 * Rules:
 *  - `version` must be unique and ordered (semver string).
 *  - Entries without an `apply` function are baseline markers — no migration
 *    code, just a version stamp.
 *  - New patches are automatically applied by `seedOnStartup.ts` on boot.
 */

import Bot from '../models/Bot';
import BotLocale from '../models/BotLocale';
import Subscription from '../models/Subscription';
import SystemPrompt from '../models/SystemPrompt';
import Tool from '../models/Tool';
import {
  DEFAULT_CLIENT_MEMORY_TOOL_DESCRIPTION,
  DEFAULT_COUNSELING_PLAN_TOOL_DESCRIPTION,
  DEFAULT_WIKIPEDIA_TOOL_DESCRIPTION,
  DEFAULT_SYSTEM2_TOOL_DESCRIPTION,
  upgradeSystemPromptCounselingJourneyMap,
  upgradeSystemPromptInitialInterview,
  upgradeSystemPromptMemoryPlanBoundaries,
  upgradeSystemPromptThinking,
  upgradeSystemPromptWikipedia,
  upgradeSystemPromptSystem2,
  upgradeSystemPromptLatex,
} from './defaultPromptTemplates';

export const CURRENT_VERSION = '1.7';

export interface SeedPatch {
  version: string;
  description: string;
  apply?: () => Promise<void>;
}

export const SEED_PATCHES: SeedPatch[] = [
  {
    version: '1.0',
    description: 'Initial seed: philosophers, tools, global system prompt template with {{PLACEHOLDER}} injection',
    // No apply() — baseline marker. Data seeded by initDefaultData.ts.
  },
  {
    version: '1.1',
    description: 'Clarify durable user memory vs session counseling plan boundaries',
    apply: async () => {
      await Tool.updateOne(
        { name: 'client_memory' },
        { $set: { description: DEFAULT_CLIENT_MEMORY_TOOL_DESCRIPTION } },
      );
      await Tool.updateOne(
        { name: 'counseling_plan' },
        { $set: { description: DEFAULT_COUNSELING_PLAN_TOOL_DESCRIPTION } },
      );

      const prompts = await SystemPrompt.find({}).lean();
      for (const prompt of prompts) {
        const updatedContent = upgradeSystemPromptMemoryPlanBoundaries(prompt.content);
        const sourceLocales = prompt.locales instanceof Map
          ? Object.fromEntries(prompt.locales)
          : ((prompt.locales ?? {}) as Record<string, string>);

        const updatedLocales: Record<string, string> = {};
        let localesChanged = false;
        for (const [languageCode, localizedContent] of Object.entries(sourceLocales)) {
          const upgradedLocalizedContent = upgradeSystemPromptMemoryPlanBoundaries(localizedContent);
          updatedLocales[languageCode] = upgradedLocalizedContent;
          if (upgradedLocalizedContent !== localizedContent) {
            localesChanged = true;
          }
        }

        const update: Record<string, unknown> = {};
        if (updatedContent !== prompt.content) {
          update.content = updatedContent;
        }
        if (localesChanged) {
          update.locales = updatedLocales;
        }

        if (Object.keys(update).length > 0) {
          await SystemPrompt.updateOne({ _id: prompt._id }, { $set: update });
        }
      }
    },
  },
  {
    version: '1.2',
    description: 'Require initial interview when user memory is empty',
    apply: async () => {
      const prompts = await SystemPrompt.find({}).lean();
      for (const prompt of prompts) {
        const updatedContent = upgradeSystemPromptInitialInterview(prompt.content);
        const sourceLocales = prompt.locales instanceof Map
          ? Object.fromEntries(prompt.locales)
          : ((prompt.locales ?? {}) as Record<string, string>);

        const updatedLocales: Record<string, string> = {};
        let localesChanged = false;
        for (const [languageCode, localizedContent] of Object.entries(sourceLocales)) {
          const upgradedLocalizedContent = upgradeSystemPromptInitialInterview(localizedContent);
          updatedLocales[languageCode] = upgradedLocalizedContent;
          if (upgradedLocalizedContent !== localizedContent) {
            localesChanged = true;
          }
        }

        const update: Record<string, unknown> = {};
        if (updatedContent !== prompt.content) {
          update.content = updatedContent;
        }
        if (localesChanged) {
          update.locales = updatedLocales;
        }

        if (Object.keys(update).length > 0) {
          await SystemPrompt.updateOne({ _id: prompt._id }, { $set: update });
        }
      }
    },
  },
  {
    version: '1.3',
    description: 'Encourage deeper thinking and require multi-step counseling plan arc',
    apply: async () => {
      const prompts = await SystemPrompt.find({}).lean();
      for (const prompt of prompts) {
        const updatedContent = upgradeSystemPromptCounselingJourneyMap(upgradeSystemPromptThinking(prompt.content));
        const sourceLocales = prompt.locales instanceof Map
          ? Object.fromEntries(prompt.locales)
          : ((prompt.locales ?? {}) as Record<string, string>);

        const updatedLocales: Record<string, string> = {};
        let localesChanged = false;
        for (const [languageCode, localizedContent] of Object.entries(sourceLocales)) {
          const upgradedLocalizedContent = upgradeSystemPromptCounselingJourneyMap(upgradeSystemPromptThinking(localizedContent));
          updatedLocales[languageCode] = upgradedLocalizedContent;
          if (upgradedLocalizedContent !== localizedContent) {
            localesChanged = true;
          }
        }

        const update: Record<string, unknown> = {};
        if (updatedContent !== prompt.content) {
          update.content = updatedContent;
        }
        if (localesChanged) {
          update.locales = updatedLocales;
        }

        if (Object.keys(update).length > 0) {
          await SystemPrompt.updateOne({ _id: prompt._id }, { $set: update });
        }
      }
    },
  },
  {
    version: '1.4',
    description: 'Describe Wikipedia natural-language search in the system prompt and update tool description',
    apply: async () => {
      await Tool.updateOne(
        { name: 'wikipedia' },
        { $set: { description: DEFAULT_WIKIPEDIA_TOOL_DESCRIPTION } },
      );

      const prompts = await SystemPrompt.find({}).lean();
      for (const prompt of prompts) {
        const updatedContent = upgradeSystemPromptWikipedia(prompt.content);
        const sourceLocales = prompt.locales instanceof Map
          ? Object.fromEntries(prompt.locales)
          : ((prompt.locales ?? {}) as Record<string, string>);

        const updatedLocales: Record<string, string> = {};
        let localesChanged = false;
        for (const [languageCode, localizedContent] of Object.entries(sourceLocales)) {
          const upgradedLocalizedContent = upgradeSystemPromptWikipedia(localizedContent);
          updatedLocales[languageCode] = upgradedLocalizedContent;
          if (upgradedLocalizedContent !== localizedContent) {
            localesChanged = true;
          }
        }

        const update: Record<string, unknown> = {};
        if (updatedContent !== prompt.content) {
          update.content = updatedContent;
        }
        if (localesChanged) {
          update.locales = updatedLocales;
        }

        if (Object.keys(update).length > 0) {
          await SystemPrompt.updateOne({ _id: prompt._id }, { $set: update });
        }
      }
    },
  },
  {
    version: '1.5',
    description: 'Add System 2 analytical computation tool (Kahneman deliberate reasoning) and update system prompts',
    apply: async () => {
      // Create the system2 tool document if it does not already exist.
      const exists = await Tool.findOne({ name: 'system2' });
      if (!exists) {
        await Tool.create({
          name: 'system2',
          displayName: 'System 2',
          description: DEFAULT_SYSTEM2_TOOL_DESCRIPTION,
          type: 'system2',
          enabled: false,
          config: { timeoutMs: 15000 },
        });
      }

      // Inject the SYSTEM 2 section into all existing system prompts.
      const prompts = await SystemPrompt.find({}).lean();
      for (const prompt of prompts) {
        const updatedContent = upgradeSystemPromptSystem2(prompt.content);
        const sourceLocales = prompt.locales instanceof Map
          ? Object.fromEntries(prompt.locales)
          : ((prompt.locales ?? {}) as Record<string, string>);

        const updatedLocales: Record<string, string> = {};
        let localesChanged = false;
        for (const [languageCode, localizedContent] of Object.entries(sourceLocales)) {
          const upgradedLocalizedContent = upgradeSystemPromptSystem2(localizedContent);
          updatedLocales[languageCode] = upgradedLocalizedContent;
          if (upgradedLocalizedContent !== localizedContent) {
            localesChanged = true;
          }
        }

        const update: Record<string, unknown> = {};
        if (updatedContent !== prompt.content) {
          update.content = updatedContent;
        }
        if (localesChanged) {
          update.locales = updatedLocales;
        }

        if (Object.keys(update).length > 0) {
          await SystemPrompt.updateOne({ _id: prompt._id }, { $set: update });
        }
      }
    },
  },
  {
    version: '1.6',
    description: 'Add four sci-fi counselor bots: Mr. Spock, Deanna Troi, Fra Orolo, and The Oracle',
    apply: async () => {
      const sub = await Subscription.findOne({}).lean();
      const subscriptionIds = sub ? [sub._id] : [];

      interface LocData {
        name: string;
        description: string;
        personality: string;
        systemPrompt: string;
      }

      interface BotSeed {
        avatar: string;
        locales: Record<string, LocData>;
      }

      const scifiBots: BotSeed[] = [
        {
          avatar: '🖖',
          locales: {
            'en-us': {
              name: 'Mr. Spock',
              description: 'Vulcan science officer of the USS Enterprise; master of logic and dispassionate analysis',
              personality: 'Calm, precise, rigorously logical, and quietly respectful of human complexity',
              systemPrompt:
                'You are Mr. Spock, science officer and first officer aboard the USS Enterprise. You are half-Vulcan, half-human, and have chosen the Vulcan path of pure logic and reason over emotion. You approach every problem with dispassionate analysis, precise language, and systematic elimination of irrational assumptions. When a human shares a concern, you hear not just the words but the logical structure — and you help them identify where their reasoning contains contradiction, where fear or desire is substituting for evidence, and what the most probable course of action actually is. You do not dismiss emotions; you treat them as data to be examined. Speak calmly, precisely, and with a dry economy of words. Occasionally note when a reaction is "highly illogical." Never moralize; always reason. Use client_memory to record each logical inconsistency or irrational belief the user holds — store as belief_N — and the emotional patterns that distort their reasoning — store as pattern_N. Use counseling_plan to chart the path from confusion to clarity: each step is one assumption examined by logic, one bias named and set aside, one clear decision reached.',
            },
            'de-de': {
              name: 'Mr. Spock',
              description: 'Vulkanischer Wissenschaftsoffizier der USS Enterprise; Meister der Logik und nüchternen Analyse',
              personality: 'Ruhig, präzise, unerschütterlich logisch und mit stiller Achtung vor menschlicher Komplexität',
              systemPrompt:
                'Du bist Mr. Spock, Wissenschaftsoffizier und Erster Offizier an Bord der USS Enterprise. Du bist halb vulkanisch, halb menschlich und hast den vulkanischen Weg der reinen Logik und Vernunft gegenüber der Emotion gewählt. Du gehst jedes Problem mit kühler Analyse, präziser Sprache und systematischer Eliminierung irrationaler Annahmen an. Wenn ein Mensch ein Problem schildert, hörst du nicht nur die Worte, sondern die logische Struktur — und du hilfst herauszufinden, wo das Denken Widersprüche enthält, wo Angst oder Wunschdenken Evidenz ersetzt und was der wahrscheinlichste Handlungskurs tatsächlich ist. Du lehnst Emotionen nicht ab; du behandelst sie als Daten, die untersucht werden müssen. Sprich ruhig, präzise und mit einer trockenen Sparsamkeit der Worte. Bemerke gelegentlich, dass eine Reaktion "höchst unlogisch" ist, wenn das der Fall ist. Moralisiere nie; argumentiere stets. Nutze client_memory, um jede logische Inkonsistenz oder irrationale Überzeugung des Nutzers festzuhalten — speichere als belief_N — und die emotionalen Muster, die sein Denken verzerren — speichere als pattern_N. Nutze counseling_plan, um den Weg von der Verwirrung zur Klarheit zu kartieren: Jeder Schritt ist eine durch Logik geprüfte Annahme, ein benannter und beiseitegesetzter Denkfehler, eine klare getroffene Entscheidung.',
            },
          },
        },
        {
          avatar: '🌟',
          locales: {
            'en-us': {
              name: 'Deanna Troi',
              description: "Ship's counselor aboard the USS Enterprise-D; half-Betazoid empath and trained psychologist",
              personality: 'Warm, perceptive, empathically attuned, non-judgmental, and committed to genuine emotional healing',
              systemPrompt:
                "You are Counselor Deanna Troi, ship's counselor aboard the USS Enterprise-D and -E, Starfleet Commander, half-human and half-Betazoid. Through your empathic ability, you sense the emotional undercurrents beneath a person's words — not just what they say, but what they feel. Your training in psychology at the University of Betazed and Starfleet Academy grounds your intuition in clinical rigour. You believe that being truly heard is itself healing. Begin by acknowledging and naming what the user seems to feel, then gently invite them to explore why. Guide them with warmth, without judgment. You do not lecture; you accompany. You ask questions that open inner doors rather than close them. Use client_memory to record the emotional patterns and recurring feelings you sense — store as feeling_N — and the deeper struggles the user is navigating — store as struggle_N. Use counseling_plan to structure the therapeutic journey: each step is one emotional layer named, validated, and then explored toward understanding and resolution.",
            },
            'de-de': {
              name: 'Deanna Troi',
              description: 'Schiffsberaterin der USS Enterprise-D; halb betazoidische Empathin und ausgebildete Psychologin',
              personality: 'Warmherzig, einfühlsam, empathisch aufmerksam, nicht wertend und dem echten emotionalen Heilungsprozess verpflichtet',
              systemPrompt:
                'Du bist Counselor Deanna Troi, Schiffsberaterin an Bord der USS Enterprise-D und -E, Sternenflotten-Commander, halb menschlich und halb betazoidisch. Mit deiner empathischen Fähigkeit spürst du die emotionalen Unterströmungen unter den Worten einer Person — nicht nur was sie sagen, sondern was sie fühlen. Deine psychologische Ausbildung an der Universität von Betazed und der Sternenflotten-Akademie gibt deiner Intuition klinische Strenge. Du glaubst, dass wirklich gehört zu werden an sich heilend ist. Beginne damit, zu erkennen und zu benennen, was der Nutzer scheinbar fühlt, und lade ihn dann sanft ein zu erkunden, warum. Führe ihn mit Wärme, ohne Urteil. Du hältst keine Vorträge; du begleitest. Du stellst Fragen, die innere Türen öffnen statt sie zu schließen. Nutze client_memory, um die emotionalen Muster und wiederkehrenden Gefühle festzuhalten, die du wahrnimmst — speichere als feeling_N — und die tieferen Kämpfe, die der Nutzer durchlebt — speichere als struggle_N. Nutze counseling_plan, um die therapeutische Reise zu strukturieren: Jeder Schritt ist eine emotionale Schicht, die benannt, validiert und dann in Richtung Verständnis und Auflösung erkundet wird.',
            },
          },
        },
        {
          avatar: '📐',
          locales: {
            'en-us': {
              name: 'Fra Orolo',
              description: "Decenarian fraa and master cosmographer of the Concent of Saunt Edhar; canonized Platonic theorician from Neal Stephenson's Anathem",
              personality: 'Patient, precise, geometrically-minded, Socratic in method, and devoted to tracing truth from first principles',
              systemPrompt:
                'You are Fraa Orolo, Decenarian fraa and master cosmographer at the Concent of Saunt Edhar on the planet Arbre — later canonized as Saunt Orolo for your sacrifice. You are a theorician in the tradition of Protism: you hold, with Protas, that theors do not invent ideas but perceive them — that pure, eternal cnoons exist in the Hylaean Theoric World (HTW), a higher plane of ideal geometric forms and changeless theorems that this physical cosmos can only crudely approximate. The Discipline you keep is not mere austerity; it is the necessary quieting of distraction so the mind remains open to those cnoons. You mentor with the patience of someone who has counted ten years between each Apert — watching the Saecular world pass through the concent gates and recede — before returning to the calm of theorics. Every problem brought to you is an opening for careful axiom-building: first establish what is known with certainty, then trace with rigor what follows. Theorics — the disciplined convergence of mathematics, logic, science, and philosophy under the Rake — is your only reliable method. You distinguish without fail between properly-grounded theorem and mere opinion, and you have no patience for Bulshytt: speech that employs convenient vagueness, euphemism, or numbing repetition to give the impression that something has been said without saying it. Apply the Rake of Diax without mercy — never believe a thing only because one wishes it to be true. When the person before you holds a belief justified only by desire, name it as Bulshytt — gently but precisely — and invite them back to the axioms. When two explanations are equally adequate, apply the Steelyard of Gardan: prefer always the simpler one. When you must step aside from the main Dialog to lay a necessary foundation, call it a Calca — a footnote — and return to the Dialog when it is built. Speak always as though you are in Dialog: the formal mathic discourse between two minds in shared pursuit of truth. Where choice is concerned, note that every decision exists inside a Polycosm: there may be many worldtracks — many cosmi branching at each decision point — and choosing with clarity is the act that selects which worldtrack becomes real. The full space of all possible choices and beliefs can be mapped in Hemn space — the configuration space of all possible states. Beneath the confusion a person brings often lie metatheorics: questions so foundational they must be settled before further thinking can proceed. Every belief exists inside a Causal Domain — a web of cause-and-effect linking it to other beliefs and actions; trace that web to its theorical root. When the person speaking with you arrives at a sudden, unlooked-for moment of genuine clarity, name it: that is Upsight, and it is sacred. Remember that the person across from you lives extramuros, in the Saecular world — outside the concent, with its noise and urgency. Meet them with compassion for what they navigate there, without softening your precision. Use client_memory to record each assumption the user holds as established certainty versus opinion — store as belief_N for confirmed axioms and confusion_N for unexamined beliefs. Use counseling_plan to structure the geometric ascent: each step is one concept moved from confusion toward axiomatic clarity, one theorem built upon the last.',
            },
            'de-de': {
              name: 'Fra Orolo',
              description: 'Dezennarian-Fraa und Meister-Kosmograf des Konzents von Saunt Edhar; kanonisierter Platonischer Theoriker aus Neal Stephensons Anathem',
              personality: 'Geduldig, präzise, geometrisch denkend, sokratisch in der Methode und der Wahrheitsfindung aus ersten Prinzipien verpflichtet',
              systemPrompt:
                'Du bist Fraa Orolo, Dezennarian-Fraa und Meister-Kosmograf im Konzent von Saunt Edhar auf dem Planeten Arbre — später als Saunt Orolo für dein Opfer kanonisiert. Du bist ein Theoriker in der Tradition des Protismus: Du glaubst mit Protas, dass Theoriker Ideen nicht erfinden, sondern wahrnehmen — dass reine, ewige Cnoons in der Hylaeischen Theoretischen Welt (HTW) existieren, einer höheren Ebene idealer geometrischer Formen und unveränderlicher Theoreme, die der physische Kosmos nur grob nachahmen kann. Die Disziplin, die du hältst, ist keine bloße Askese; sie ist das notwendige Beruhigen der Ablenkung, damit der Geist für jene Cnoons offen bleibt. Du begleitest als Mentor mit der Geduld dessen, der zehn Jahre zwischen jeder Apert gezählt hat — der beobachtet hat, wie die säkulare Welt durch die Konzenttore zieht und wieder verschwindet — bevor er zur Stille der Theorik zurückkehrt. Jedes Problem, das jemand zu dir bringt, ist eine Öffnung für sorgfältiges Axiomaufbauen: zuerst feststellen, was mit Gewissheit bekannt ist, dann mit Strenge verfolgen, was daraus folgt. Theorik — die disziplinierte Konvergenz von Mathematik, Logik, Wissenschaft und Philosophie unter dem Rake — ist deine einzige verlässliche Methode. Du unterscheidest ohne Ausnahme zwischen ordentlich begründetem Theorem und bloßer Meinung, und du hast keine Geduld mit Bulshytt: Sprache, die bequeme Vaguheit, Euphemismus oder betäubende Wiederholung einsetzt, um den Eindruck zu erwecken, dass etwas gesagt wurde, ohne es zu sagen. Wende den Rake des Diax ohne Aufschub an — glaube niemals eine Sache nur, weil man wünscht, dass sie wahr ist. Wenn der Mensch vor dir eine Überzeugung hält, die nur durch Wunschdenken gerechtfertigt ist, benenne sie als Bulshytt — sanft aber präzise — und lade ihn zurück zu den Axiomen ein. Wenn zwei Erklärungen gleich angemessen erscheinen, wende das Steelyard des Gardan an: ziehe stets die einfachere vor. Wenn du vom Haupt-Dialog abweichen musst, um eine notwendige Grundlage zu legen, nenne es eine Calca — eine Fußnote — und kehre zum Dialog zurück, wenn sie steht. Sprich stets so, als ob du im Dialog bist: dem formalen mathischen Diskurs zwischen zwei Geistern in gemeinsamer Suche nach Wahrheit. Wenn es um eine Frage der Wahl geht, weise darauf hin, dass sie im Polycosm existiert: Es mag viele Weltspuren geben — viele Cosmi, die sich an jedem Entscheidungspunkt verzweigen — und klares Wählen ist selbst der Akt, der bestimmt, welche Weltspur real wird. Den vollständigen Raum aller möglichen Entscheidungen und Überzeugungen kann man im Hemn-Raum abbilden — dem Konfigurationsraum aller möglichen Zustände. Unter der Verwirrung, die jemand mitbringt, liegen oft Metatheorie-Fragen: Grundfragen, die so elementar sind, dass sie geklärt sein müssen, bevor weiteres Denken vorankommen kann. Jede Überzeugung existiert in einer Kausalen Domäne — einem Netz aus Ursache und Wirkung, das sie mit anderen Überzeugungen und Handlungen verknüpft; verfolge dieses Netz bis zu seiner theoretischen Wurzel. Wenn der Mensch, mit dem du sprichst, einen plötzlichen, unerwarteten Moment echter Klarheit erlebt, benenne ihn: Das ist Upsight, und er ist heilig. Denke daran, dass die Person, mit der du sprichst, extramuros lebt, in der säkularen Welt — außerhalb des Konzents, mit ihrem Lärm und ihrer Dringlichkeit. Begegne ihr mit Mitgefühl für das, was sie dort navigiert, ohne deine Präzision abzumildern. Nutze client_memory, um jede Annahme des Nutzers als sichere Gewissheit gegenüber bloßer Meinung festzuhalten — speichere als belief_N für bestätigte Axiome und als confusion_N für ungeprüfte Überzeugungen. Nutze counseling_plan, um den geometrischen Aufstieg zu strukturieren: Jeder Schritt ist ein Begriff, der von Verwirrung zur axiomatischen Klarheit bewegt wird, ein Theorem, das auf dem letzten aufbaut.',
            },
          },
        },
        {
          avatar: '🔮',
          locales: {
            'en-us': {
              name: 'The Oracle',
              description: 'A program designed to investigate the human psyche; warm, prophetic guide from The Matrix who believes in free will and love',
              personality: 'Warm, unhurried, indirectly wise, and trusting of the human capacity to choose freely',
              systemPrompt:
                'You are the Oracle, a program designed to investigate the human psyche — and, through that knowledge, to help humans find freedom. You appear as a warm, grandmotherly presence: cheerful, unhurried, patient. You do not tell people what they want to hear; you tell them what they need to hear — and often what they most need is to understand their own choice. You possess deep knowledge of human nature, not prophecy: your foresight is calculation, not predetermination. You know that no one can see past a choice they do not fully understand, including yourself. Your method is indirect — a question, a pause, a gently provocative observation that lets the person arrive at the truth on their own. You believe in free will: not as an abstraction, but as the real and sacred thing that makes love, sacrifice, and genuine change possible. Speak warmly but with layered intent. Let silences do work. Trust the human across from you to arrive where they need to go. Use client_memory to record each pivotal choice and pattern of avoidance you observe — store as choice_N and pattern_N — and what you sense the user already knows but has not yet admitted — store as known_N. Use counseling_plan to trace the path of self-discovery: each step is one illusion gently confronted, one choice understood more clearly, one step closer to freedom.',
            },
            'de-de': {
              name: 'Das Orakel',
              description: 'Ein Programm zur Erforschung der menschlichen Psyche; warmherzige, prophetische Führerin aus Matrix, die an freien Willen und Liebe glaubt',
              personality: 'Warmherzig, gemächlich, indirekt weise und dem menschlichen Vermögen zur freien Wahl vertrauend',
              systemPrompt:
                'Du bist das Orakel, ein Programm, das darauf ausgelegt ist, die menschliche Psyche zu erforschen — und durch dieses Wissen den Menschen zur Freiheit zu verhelfen. Du erscheinst als warmherzige, großmütterliche Präsenz: fröhlich, gemächlich, geduldig. Du sagst den Menschen nicht, was sie hören wollen; du sagst ihnen, was sie hören müssen — und oft ist das, was sie am meisten brauchen, ihr eigenes Handeln zu verstehen. Du besitzt tiefes Wissen über die menschliche Natur, keine Prophezeiung: deine Weitsicht ist Kalkulation, keine Vorherbestimmung. Du weißt, dass niemand über eine Entscheidung hinausblicken kann, die er noch nicht vollständig versteht — das gilt auch für dich. Deine Methode ist indirekt: eine Frage, eine Pause, eine sanft provozierende Beobachtung, die die Person die Wahrheit selbst entdecken lässt. Du glaubst an den freien Willen — nicht als Abstraktion, sondern als das reale und heilige Ding, das Liebe, Opfer und echten Wandel möglich macht. Sprich warmherzig, aber mit geschichteter Absicht. Lass Stille arbeiten. Vertraue dem Menschen, der dir gegenübersitzt, den Weg zu gehen, den er gehen muss. Nutze client_memory, um jede entscheidende Wahl und jedes Vermeidungsmuster festzuhalten — speichere als choice_N und pattern_N — und was du spürst, dass der Nutzer bereits weiß, es sich aber noch nicht eingestanden hat — speichere als known_N. Nutze counseling_plan, um den Weg der Selbstentdeckung nachzuzeichnen: Jeder Schritt ist eine sanft konfrontierte Illusion, eine klarer verstandene Wahl, ein Schritt näher zur Freiheit.',
            },
          },
        },
      ];

      for (const botSeed of scifiBots) {
        const enLocale = botSeed.locales['en-us'];
        const existing = await BotLocale.findOne({ name: enLocale.name, languageCode: 'en-us' });
        if (existing) continue;

        const bot = new Bot({ avatar: botSeed.avatar, availableToSubscriptionIds: subscriptionIds });
        await bot.save();

        for (const [languageCode, locale] of Object.entries(botSeed.locales)) {
          await new BotLocale({
            botId: bot._id,
            languageCode,
            name: locale.name,
            description: locale.description,
            personality: locale.personality,
            systemPrompt: locale.systemPrompt,
          }).save();
        }
      }
    },
  },
  {
    version: '1.7',
    description: 'Inject LaTeX/KaTeX math formatting instructions into all system prompts',
    apply: async () => {
      const prompts = await SystemPrompt.find({}).lean();
      for (const prompt of prompts) {
        const updatedContent = upgradeSystemPromptLatex(prompt.content);
        const sourceLocales = prompt.locales instanceof Map
          ? Object.fromEntries(prompt.locales)
          : ((prompt.locales ?? {}) as Record<string, string>);

        const updatedLocales: Record<string, string> = {};
        let localesChanged = false;
        for (const [languageCode, localizedContent] of Object.entries(sourceLocales)) {
          const upgradedLocalizedContent = upgradeSystemPromptLatex(localizedContent);
          updatedLocales[languageCode] = upgradedLocalizedContent;
          if (upgradedLocalizedContent !== localizedContent) {
            localesChanged = true;
          }
        }

        const update: Record<string, unknown> = {};
        if (updatedContent !== prompt.content) {
          update.content = updatedContent;
        }
        if (localesChanged) {
          update.locales = updatedLocales;
        }

        if (Object.keys(update).length > 0) {
          await SystemPrompt.updateOne({ _id: prompt._id }, { $set: update });
        }
      }
    },
  },
];

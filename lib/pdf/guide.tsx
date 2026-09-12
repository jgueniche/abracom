import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { HelpBlock } from "@/lib/help/outline";

/* Same charter as the application since session 16 (ADR-0032), and the serif
   for the school's voice — Times-Roman ships with @react-pdf. */
const INK = "#0f1e33";
const BLUE = "#0038b8";
const MUTED = "#55657c";
const RULE = "#becadc";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10.5, fontFamily: "Helvetica", color: INK, lineHeight: 1.4 },
  /**
   * A running head, not a footer.
   *
   * `position: absolute` + `fixed` + `render` is the one combination
   * @react-pdf cannot lay out: past a dozen pages it translates a text block by
   * -8.7e21 points and throws "unsupported number". The three guides of session
   * 15 were one or two pages each and never reached it; "mon guide" is a dozen
   * for the direction, so the page number moved to a fixed line in the flow.
   */
  head: {
    fontSize: 8,
    color: MUTED,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
    paddingBottom: 4,
  },
  /* The page sets `lineHeight: 1.4`, which a 22 pt line inherits as a box
     shorter than its own descenders: the subtitle was printed through the
     tail of the "g" of "Mon guide". A display line states its own leading. */
  brand: {
    fontSize: 8,
    color: BLUE,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  title: {
    fontSize: 22,
    fontFamily: "Times-Roman",
    color: INK,
    lineHeight: 1.2,
    marginBottom: 2,
  },
  subtitle: { fontSize: 10, color: MUTED, marginBottom: 8 },
  topic: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: MUTED,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 20,
    marginBottom: 4,
    borderTopWidth: 1,
    borderTopColor: RULE,
    paddingTop: 10,
  },
  heading: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: INK,
    marginTop: 14,
    marginBottom: 4,
  },
  paragraph: { marginBottom: 4 },
  bullet: { flexDirection: "row", marginBottom: 3, paddingLeft: 6 },
  dot: { width: 10 },
  bulletText: { flex: 1 },
});

export type GuideArticle = { title: string; blocks: HelpBlock[] };
export type GuideTopic = { heading: string; articles: GuideArticle[] };

export type GuideData = {
  appName: string;
  title: string;
  subtitle: string;
  topics: GuideTopic[];
  footer: string;
};

function Blocks({ blocks }: { blocks: HelpBlock[] }) {
  return (
    <>
      {blocks.map((block, index) =>
        block.kind === "bullet" ? (
          <View key={index} style={styles.bullet}>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.bulletText}>{block.text}</Text>
          </View>
        ) : (
          <Text key={index} style={styles.paragraph}>
            {block.text}
          </Text>
        ),
      )}
    </>
  );
}

/**
 * "My guide": every article this reader sees on `/aide`, in the same order,
 * under the same topic headings — one document per person rather than one per
 * file, since the articles are now cut by question and not by role (ADR-0048).
 */
export function GuideDocument({ data }: { data: GuideData }) {
  return (
    <Document title={data.title} author={data.appName} language="fr">
      <Page size="A4" style={styles.page}>
        <Text
          style={styles.head}
          fixed
          render={({ pageNumber, totalPages }) => `${data.footer} · ${pageNumber} / ${totalPages}`}
        />
        {/* The same anatomy as the booklet and the e-mails: a blue eyebrow
            naming the sender, then the title in the school's serif. */}
        <Text style={styles.brand}>{data.appName}</Text>
        <Text style={styles.title}>{data.title}</Text>
        <Text style={styles.subtitle}>{data.subtitle}</Text>
        {/* Flat on purpose: a wrapping View per topic, nested in the page, was
            the other half of the layout failure described above. */}
        {data.topics.flatMap((topic) => [
          <Text key={topic.heading} style={styles.topic}>
            {topic.heading}
          </Text>,
          ...topic.articles.flatMap((article) => [
            <Text key={`${topic.heading}/${article.title}`} style={styles.heading}>
              {article.title}
            </Text>,
            <Blocks key={`${topic.heading}/${article.title}/body`} blocks={article.blocks} />,
          ]),
        ])}
      </Page>
    </Document>
  );
}

export async function renderGuide(data: GuideData): Promise<Buffer> {
  return renderToBuffer(<GuideDocument data={data} />);
}

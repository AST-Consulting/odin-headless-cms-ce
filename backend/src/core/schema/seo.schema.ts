import { Prop, Schema } from '@nestjs/mongoose';

/*Open Graph (OG) metadata: represents the Open Graph (OG) metadata,
which is used to control how your content is presented when shared
on social media platforms like Facebook, Twitter, or LinkedIn.
*/
export class OG {
  @Prop({ type: String, required: false })
  title: string;

  @Prop({ type: String, required: false })
  description: string;

  @Prop({ type: String, required: false })
  url: string;

  @Prop({ type: String, required: false })
  image: string;
}

/**This class encapsulates general SEO-related metadata
 * for a web page or content item.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
@Schema({ _id: false })
export class Seo {
  @Prop({ type: String, required: false })
  title: string;

  @Prop({ type: String, required: false })
  metaDescription: string;

  @Prop({ type: [String], required: false })
  keywords?: string[];

  @Prop({ type: OG, required: false })
  og: OG;
}

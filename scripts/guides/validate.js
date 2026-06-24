import { loadGuideContent } from './content.js';

try {
  const content = loadGuideContent();
  for (const warning of content.warnings) {
    console.warn(`Warning: ${warning}`);
  }
  console.log(`Guide content root: ${content.contentRoot}`);
  console.log(`Guides: ${content.details.length}`);
  console.log(`Media files: ${content.mediaFiles.length}`);
  console.log(`Index items: ${content.index.items.length}`);
  if (!content.details.length) {
    console.log('No local guides found. /api/guides will return an empty list until content is uploaded.');
  }
} catch (error) {
  console.error(error.message || error);
  process.exitCode = 1;
}

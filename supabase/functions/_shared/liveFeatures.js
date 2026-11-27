// What is LIVE on tryzyvo.com right now, for the parts that talk about the whole site: Maestro's facts and prompt, the
// chat's cards, the Create bar, the new Home (owner, 2026-11-27). A feature that exists in code but is not live is never
// offered or explained. Flip a line to true in the commit that takes that feature live (its migration run, its
// functions deployed, its page on main).
//   rewards        free credits for videos and invites (/rewards, _shared/rewards/config.js)
//   affiliate      the creator program (/affiliate, _shared/affiliate/config.js)
//   referenceScan    "+ Reference video" and the scan (reference-api + the scan machine)
//   referenceImages  reference pictures with a role (plain uploads to the user's own folder; the Director plans with them)
export const LIVE = Object.freeze({
  rewards: false,
  affiliate: false,
  referenceScan: false,
  referenceImages: true,
});

import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const resend = new Resend(process.env.RESEND_API_KEY);

const emails = [
    "zzyloai@gmail.com",
"lukasthebest8709@gmail.com",
"zozaeditor@gmail.com",
"vpee011@gmail.com",
"rayyanshahxx@gmail.com",
"orazbaysaifulla@gmail.com",
"pedrtex.08@gmail.com",
"reddtt01@gmail.com",
"liteninggyt@gmail.com",
"maksotnursat4@gmail.com",
"danielsitop777@gmail.com",
"tylerbigman2015@gmail.com",
"omardkg547@gmail.com",
"emanemansulaeman483@gmail.com",
"abetefera5467@gmail.com",
"agerry994@gmail.com",
"upwardlift6@gmail.com",
"zakilakid0@gmail.com",
"pax.max1116@gmail.com",
"abucha779@gmail.com",
"juniorturner237@gmail.com",
"vundlamethuli3@gmail.com",
"akoredeodelabu10@gmail.com",
"jaime_rozoramirez@metjags.com",
"rodvin000@gmail.com",
"mokhchanekhalifa190@gmail.com",
"class5drivingclasses@gmail.com",
"miggi5542@gmail.com",
"elliotsakkal@gmail.com",
"isk13.00000@gmail.com",
"esajansikandari1212@gmail.com",
"willeyabram7@gmail.com",
"axxxxz755@gmail.com",
"arzin11@icloud.com",
"miguel.januario.08@gmail.com",
"salvationlastb@gmail.com",
"twigplantar@gmail.com",
"comedieroh@gmail.com",
"tajculbert@gmail.com",
"jamelsam22@gmail.com",
"a.wikarskii@gmail.com",
"steneeriktilgand10@gmail.com",
"ramsesramos727@gmail.com",
"nathanfalcoryand@gmail.com",
"thantarkarzaw@gmail.com",
"nathanfalcoryan@outlook.it",
"sodiqakorede345@gmail.com",
"eromoseleosedebame@gmail.com",
"owennikkiorton@gmail.com",
"daniyalmmalik@gmail.com",
"lucianoreza30@gmail.com",
"rizaria13@gmail.com",
"gurhagai@gmail.com",
"bugabear810@gmail.com",
"eeeeew221@gmail.com",
"ninja.matt1400@gmail.com",
"adamszalek707@gmail.com",
"gabrielitsikoradze@gmail.com",
"chibi.mita.help@gmail.com",
"sekingerlevin@gmail.com",
"kenyoneast452@gmail.com",
"donica1570@bigonla.com",
"tontoooo6767@gmail.com",
"julio11018.e@gmail.com",
"hillaryscott684@gmail.com",
"officialspektorbaal@gmail.com",
"boshkovzoran32@gmail.com",
"szagabor110@gmail.com",
"harrydinglenuts8@gmail.com",
"matteoiliketrolls@gmail.com",
"muzammielsyukri@gmail.com",
"zestybob2@gmail.com",
"aresaekares@gmail.com",
"dmax94300@gmail.com",
"farrouckawad@gmail.com",
"cookiethepupyt@gmail.com",
"pmedliny@gmail.com",
"jaydentylerdangerfield@gmail.com",
"thechocolateman31@gmail.com",
"privategamestuff@gmail.com",
"gdestefano473@gmail.com",
"kymanib1847@gmail.com",
"thorntonblake842@gmail.com",
"wyllanfrancisco9@gmail.com",
"jdhehj592@gmail.com",
"antoniogdgsikz2002@gmail.com",
"alexhodgson@icloud.com",
"nemesismapoza@gmail.com",
"bweakfeast2243434@gmail.com",
"zachlindell67@gmail.com",
"jazgarskiw@gmail.com",
"georgewheatley2011@icloud.com",
"cernavcacristi2@gmail.com",
"jinyancai@gmail.com",
"trevontetrey9@gmail.com",
"marineearly@gmail.com",
"benditonfeet@gmail.com",
"jaydensegree8@gmail.com",
"goldenvibe6262@gmail.com",
"lexksinurway@gmail.com",
"xackarybermil@gmail.com",
"johnny.poston@icloud.com",
"naciumatias@gmail.com",
"evgeniya.taneva@gmail.com",
"zaclarrivee@icloud.com",
"bosschieterisaiah@icloud.com",
"jassimalshimmary861@gmail.com",
"geentijd64221@gmail.com",
"alexhid107@gmail.com",
"zay993152@gmail.com",
"testelovableconta@gmail.com",
"txghffgggfdgggf@gmail.com",
"kendrick.sargent2412@icloud.com",
"vittorio.martin.lorenzetti@gmail.com",
"taylenbrooks39@gmail.com",
"dpabata@gmail.com",
"aaronjames29712@gmail.com",
"mekhaithomas5@gmail.com",
"pablo42268@gmail.com",
"ansgardejong4@gmail.com",
"murilohenriquef2010@gmail.com",
"murilohf2010@gmail.com",
"jude.croninwebb@icloud.com",
"ronniejohnv@gmail.com",
"sniperkoladekyt@gmail.com",
"y6884850@gmail.com",
"dedodedo@gmail.com",
"misaelleonardo345@gmail.com",
"aztalimg@gmail.com",
"kalebvlog77@gmail.com",
"hagauwuw@gmail.com",
"davidrahimd@gmail.com",
"ivanngyx0911@gmail.com",
"omar.hernandez985@icloud.com",
"bkehren34@gmail.com",
"a15337952@gmail.com",
"osvaldomendoza444@gmail.com",
"redditstories1830@gmail.com",
"kyreekeys39@gmail.com",
"koigzccccv@gmail.com",
"bandiththyna@gmail.com",
"lovemisile2022@gmail.com",
"enriquevdecastro@gmail.com",
"dinglerondel@gmail.com",
"maicolpetit35@gmail.com",
"essential110011@gmail.com",
"issemohamedqadar@gmail.com",
"jamaldicksonafricanman69@gmail.com",
"ifnoifno770@gmail.com",
"telod86913@bigonla.com",
"vierrudaniel69@gmail.com",
"shitshapens@gmail.com",
"jrakhra2004@yahoo.com",
"antoniohud@icloud.com",
"adelmammadova13@gmail.com",
"jakeptconnor@gmail.com",
"nekoswaann@gmail.com",
"micaelreis2200@gmail.com",
"gabitzugabitu@gmail.com",
"ganbayrudambayr@gmail.com",
"vaneqyvo@denipl.com",
"eimannnoel@gmail.com",
"osmarq148@gmail.com",
"pevak39802@bigonla.com",
"sebastian.sitzberger@googlemail.com",
"americanguy166@gmail.com",
"arashekam2016@gmail.com",
"saelzle@myyahoo.com",
"andersonmaxx86@gmail.com",
"eddie4liferrr@gmail.com",
"eugeniomoli891@gmail.com",
"martinsvolksons7@gmail.com",
"vpeehuhtala@gmail.com"
  // your full list stays the same
];

function emailHTML() {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#0f1117;padding:40px;color:white">
    <div style="max-width:600px;margin:auto">

      <h2>MiniMax Hailuo 2.3 Fast is now live</h2>

      <p style="color:#b3b3b3">
      We just released a new video generation model inside Zyvo.
      </p>

      <p style="color:#b3b3b3">
      <b>MiniMax Hailuo 2.3 Fast</b> creates smoother AI videos with faster generation —
      perfect for TikTok, reels and short-form content.
      </p>

      <div style="margin:30px 0">
        <a href="https://tryzyvo.com/workspace/video-generator"
        style="background:#7A3BFF;color:white;padding:14px 22px;border-radius:8px;text-decoration:none;font-weight:600;">
        Try it now →
        </a>
      </div>

      <p style="color:#777;font-size:13px">
      — Zyvo
      </p>

    </div>
  </div>
  `;
}

async function sendEmails() {

  const START = 100; // start from 100
  const batch = emails.slice(START); // from 100 → end

  console.log(`Sending ${batch.length} emails...`);

  for (const email of batch) {
    try {
      const { error } = await resend.emails.send({
        from: "Niko from Zyvo <niko@tryzyvo.com>", // 🔥 CHANGED
        to: email,
        subject: "MiniMax Hailuo 2.3 Fast is now available",
        html: emailHTML(),
        reply_to: "niko@tryzyvo.com"
      });

      if (error) {
        console.error("Failed:", email, error);
      } else {
        console.log("Sent to:", email);
      }

    } catch (err) {
      console.error("Error sending to:", email, err);
    }

    // safer delay (important for deliverability)
    await new Promise(r => setTimeout(r, 1200));
  }

  console.log("Batch finished.");
}

sendEmails();
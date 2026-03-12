import { Resend } from "resend";
import dotenv from "dotenv";
import { XrayUpdateEmail } from "./xrayUpdate.js";

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
"upwardlift6@gmail.com",
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
"hillaryscott684@gmail.com",
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
"georgewheatley2011@icloud.com"
];

async function sendEmails() {

  for (const email of emails) {

    try {

      const { error } = await resend.emails.send({
        from: "Zyvo Updates <updates@tryzyvo.com>",
        to: email,
        subject: "🦴 New Viral Style Just Dropped in Zyvo",
        html: XrayUpdateEmail()
      });

      if (error) {
        console.error("Failed:", email, error);
      } else {
        console.log("Sent to:", email);
      }

    } catch (err) {
      console.error("Error sending to:", email, err);
    }

    // small delay so Gmail doesn't flag spam
    await new Promise(r => setTimeout(r, 800));

  }

}

sendEmails();
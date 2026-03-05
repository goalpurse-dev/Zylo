import { useState } from "react"
import { createPortal } from "react-dom"
import { supabase } from "../lib/supabaseClient"

export default function EmailConsentModal({ user }) {

  const [updates, setUpdates] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleContinue = async () => {
    setLoading(true)

    await supabase
      .from("profiles")
      .update({ email_updates: updates })
      .eq("id", user.id)

    setLoading(false)
    window.location.reload()
  }

  return createPortal(

    <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-md bg-black/30">

      <div className="
        w-[92%]
        max-w-md
        p-8
        rounded-2xl
        border
        shadow-2xl
        transition
      "
      style={{
        background:"#141622",
        borderColor:"#1F2230"
      }}
      >

        {/* TITLE */}
        <h2
          className="text-xl font-semibold mb-3"
          style={{color:"#F4F6FB"}}
        >
          Stay ahead with Zyvo 🚀
        </h2>

        {/* DESCRIPTION */}
        <p
          className="text-sm mb-7 leading-relaxed"
          style={{color:"#B7BBC6"}}
        >
          Get the newest AI tools, viral prompts and feature updates
          before everyone else.
        </p>


        {/* CHECKBOX */}
        <label className="
          flex
          items-center
          gap-3
          mb-7
          cursor-pointer
          px-3
          rounded-lg
          transition
          hover:bg-[#1A1D2B]
        ">

          <input
            type="checkbox"
            checked={updates}
            onChange={(e)=>setUpdates(e.target.checked)}
            className="
              w-4
              h-4
              accent-purple-500
              cursor-pointer
            "
          />


          <span
            className="text-sm"
            style={{color:"#B7BBC6"}}
          >
            Send me viral AI prompts and new tools 
          </span>

        </label>

        {/* BUTTON */}
        <button
          onClick={handleContinue}
          disabled={loading}
          className="
            w-full
            py-3
            rounded-xl
            text-white
            font-semibold
            bg-gradient-to-r
            from-[#7A3BFF]
            to-[#6F3AE6]
            shadow-lg
            shadow-purple-600/20
            hover:scale-[1.02]
            hover:shadow-purple-600/40
            transition
            disabled:opacity-50
            disabled:cursor-not-allowed
          "
        >
          {loading ? "Saving..." : "Continue"}
        </button>

      </div>

    </div>,

    document.body
  )
}
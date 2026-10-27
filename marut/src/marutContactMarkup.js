const PHONE = import.meta.env.VITE_WHATSAPP_NUMBER;
export const markup = 
`
<section class="marut-contact" id="contact-marut" aria-labelledby="contact-marut-title">
    <div class="marut-contact-copy">
      <div class="marut-contact-eyebrow">LET'S CONNECT</div>
      <h2 id="contact-marut-title">Good food starts with a conversation<span aria-hidden="true">.</span></h2>
      <p>Questions about our greens, restaurant supply or partnerships? Tell us what you have in mind. We'll help you find the right way to bring MARUT to your table.</p>
    </div>
    <div class="marut-contact-actions">
      <a class="marut-contact-link" href="https://wa.me/${PHONE}?text=Hi%20MARUT!%20I%27d%20like%20to%20enquire%20about%20your%20microgreens." target="_blank" rel="noopener noreferrer" aria-label="Contact MARUT on WhatsApp">
        <span class="marut-contact-icon" aria-hidden="true">↗</span>
        <span>
          <strong>Order on WhatsApp</strong>
          <small>Choose your greens and pack size. We'll confirm your order with you directly.</small>
        </span>
        <span class="marut-contact-arrow" aria-hidden="true">↗</span>
      </a>
      <a class="marut-contact-link" href="mailto:info@marut.co.in?subject=Enquiry%20for%20MARUT" aria-label="Email MARUT at info@marut.co.in">
        <span class="marut-contact-icon" aria-hidden="true">✉</span>
        <span>
          <strong>Email enquiries</strong>
          <small>For product questions, wholesale, restaurant supply and partnerships.</small>
          <small class="marut-contact-email">info@marut.co.in</small>
        </span>
        <span class="marut-contact-arrow" aria-hidden="true">↗</span>
      </a>
      <a class="marut-contact-link" href="mailto:support@marut.co.in?subject=MARUT%20Customer%20Support" aria-label="Email MARUT customer support at support@marut.co.in">
        <span class="marut-contact-icon" aria-hidden="true">✉</span>
        <span>
          <strong>Customer Support</strong>
          <small>For order updates, delivery questions and post-purchase assistance.</small>
          <small class="marut-contact-email">support@marut.co.in</small>
        </span>
        <span class="marut-contact-arrow" aria-hidden="true">↗</span>
      </a>
    </div>
  </section>
`
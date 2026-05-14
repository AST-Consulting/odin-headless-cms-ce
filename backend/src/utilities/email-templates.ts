export function getOtpMail(name: string, otp: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">Verification Code</h2>
      <p>Hello ${name},</p>
      <p>Your verification code is:</p>
      <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
        ${otp}
      </div>
      <p>This code will expire in 10 minutes.</p>
      <p>If you didn't request this code, please ignore this email.</p>
      <p>Best regards,<br>Your App Team</p>
      <div style="color: #666; font-size: 12px; margin-top: 20px; border-top: 1px solid #eee; padding-top: 20px;">
        <p>This is an automated message, please do not reply to this email.</p>
      </div>
    </div>
  `;
}

export function getUserDeactivatedMail(name: string, propertyName: string, brandName: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <h2 style="color: #e53e3e;">Account Deactivated</h2>
      <p>Hello ${name},</p>
      <p>This is to inform you that your access to <strong>${propertyName}</strong> has been deactivated.</p>
      <p style="background-color: #fff5f5; border-left: 4px solid #e53e3e; padding: 15px; margin: 20px 0;">
        You are deactivated for this property context. Please contact the administrator to reactivate your access.
      </p>
      <p>If you have any questions, please reach out to your team lead or system administrator.</p>
      <p>Best regards,<br>${brandName} Team</p>
      <div style="color: #666; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
        <p>This is an automated notification from ${brandName}.</p>
      </div>
    </div>
  `;
}

export function getUserInvitationMail(name: string, tempPassword: string, magicLink: string, propertyName: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #f9fafb; border-radius: 8px;">
      <div style="text-align: center; padding-bottom: 20px;">
        <h2 style="color: #4f46e5; margin-bottom: 10px;">Welcome to ${propertyName}!</h2>
        <p style="font-size: 16px; color: #6b7280;">You've been invited to join our platform.</p>
      </div>
      <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <p style="margin-top: 0;">Hello ${name},</p>
        <p>An account has been created for you on <strong>${propertyName}</strong>. To get started, please click the button below to verify your account and set your permanent password.</p>
        
        <div style="text-align: center; margin: 40px 0;">
          <a href="${magicLink}" style="background-color: #4f46e5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Verify & Set Password</a>
        </div>

        <p style="font-size: 14px; color: #6b7280; line-height: 1.5;">
          If the button doesn't work, you can copy and paste this link into your browser:<br>
          <a href="${magicLink}" style="color: #4f46e5; word-break: break-all;">${magicLink}</a>
        </p>
      </div>
      <div style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 25px;">
        <p>This is an automated message, please do not reply.</p>
      </div>
    </div>
  `;
}

export function getUserAdminResetMail(name: string, tempPassword: string, magicLink: string, brandName: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #fef2f2; border-radius: 8px;">
      <div style="text-align: center; padding-bottom: 20px;">
        <h2 style="color: #dc2626; margin-bottom: 10px;">Account Password Reset</h2>
        <p style="font-size: 16px; color: #6b7280;">Your password has been reset by an administrator.</p>
      </div>
      <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <p style="margin-top: 0;">Hello ${name},</p>
        <p>An administrator has reset your password for <strong>${brandName}</strong>. Please click the button below to log in and set a new permanent password.</p>
        
        <div style="text-align: center; margin: 40px 0;">
          <a href="${magicLink}" style="background-color: #dc2626; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Login & Reset Password</a>
        </div>

        <p style="font-size: 14px; color: #6b7280; line-height: 1.5;">
          For your security, please change your password immediately after logging in. If you did not expect this, please contact your administrator.
        </p>
      </div>
      <div style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 25px;">
        <p>This is an automated notification from ${brandName}.</p>
      </div>
    </div>
  `;
}


export function getUserReactivationMail(name: string, tempPassword: string, magicLink: string, brandName: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #f0fdf4; border-radius: 8px;">
      <div style="text-align: center; padding-bottom: 20px;">
        <h2 style="color: #16a34a; margin-bottom: 10px;">Welcome Back!</h2>
        <p style="font-size: 16px; color: #4b5563;">Your account has been reactivated.</p>
      </div>
      <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <p style="margin-top: 0;">Hello ${name},</p>
        <p>We are happy to inform you that your account on <strong>${brandName}</strong> has been reactivated by an administrator. Please click the button below to log in and set your password.</p>
        
        <div style="text-align: center; margin: 40px 0;">
          <a href="${magicLink}" style="background-color: #16a34a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Login & Reset Password</a>
        </div>

        <p style="font-size: 14px; color: #6b7280; line-height: 1.5;">
          For your security, please change your password immediately after logging in.
        </p>
      </div>
      <div style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 25px;">
        <p>This is an automated notification.</p>
      </div>
    </div>
  `;
}

export function getWelcomeMail(name: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to SEO Pilot</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Arial', sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #f8fafc;
            }
            
            .container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 40px 30px;
                text-align: center;
            }
            
            .logo {
                font-size: 28px;
                font-weight: bold;
                margin-bottom: 10px;
                letter-spacing: 1px;
            }
            
            .tagline {
                font-size: 16px;
                opacity: 0.9;
                margin-bottom: 0;
            }
            
            .content {
                padding: 40px 30px;
            }
            
            .welcome-message {
                font-size: 20px;
                color: #2d3748;
                margin-bottom: 20px;
                font-weight: 600;
            }
            
            .intro-text {
                font-size: 16px;
                color: #4a5568;
                margin-bottom: 30px;
                line-height: 1.7;
            }
            
            .features-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                margin-bottom: 30px;
            }
            
            .feature-item {
                background: #f7fafc;
                padding: 20px;
                border-radius: 8px;
                border-left: 4px solid #667eea;
            }
            
            .feature-icon {
                font-size: 24px;
                margin-bottom: 8px;
            }
            
            .feature-title {
                font-size: 14px;
                font-weight: 600;
                color: #2d3748;
                margin-bottom: 6px;
            }
            
            .feature-desc {
                font-size: 13px;
                color: #718096;
                line-height: 1.5;
            }
            
            .cta-section {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px;
                text-align: center;
                border-radius: 8px;
                margin-bottom: 30px;
            }
            
            .cta-title {
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 15px;
            }
            
            .cta-button {
                display: inline-block;
                background: #ffffff;
                color: #667eea;
                padding: 12px 30px;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 600;
                font-size: 16px;
                transition: all 0.3s ease;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            
            .cta-button:hover {
                background: #f7fafc;
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
            }
            
            .next-steps {
                background: #edf2f7;
                padding: 25px;
                border-radius: 8px;
                margin-bottom: 30px;
            }
            
            .next-steps h3 {
                color: #2d3748;
                margin-bottom: 15px;
                font-size: 16px;
            }
            
            .steps-list {
                list-style: none;
                padding: 0;
            }
            
            .steps-list li {
                padding: 8px 0;
                color: #4a5568;
                font-size: 14px;
                position: relative;
                padding-left: 25px;
            }
            
            .steps-list li:before {
                content: "✓";
                position: absolute;
                left: 0;
                color: #667eea;
                font-weight: bold;
            }
            
            .support-section {
                text-align: center;
                color: #718096;
                font-size: 14px;
                margin-bottom: 20px;
            }
            
            .support-section a {
                color: #667eea;
                text-decoration: none;
                font-weight: 600;
            }
            
            .footer {
                background: #2d3748;
                color: #a0aec0;
                padding: 25px 30px;
                text-align: center;
                font-size: 12px;
            }
            
            .footer a {
                color: #667eea;
                text-decoration: none;
            }
            
            .social-links {
                margin-top: 15px;
            }
            
            .social-links a {
                display: inline-block;
                margin: 0 8px;
                color: #a0aec0;
                text-decoration: none;
                font-size: 14px;
            }
            
            @media (max-width: 600px) {
                .features-grid {
                    grid-template-columns: 1fr;
                }
                
                .container {
                    margin: 0 10px;
                }
                
                .header, .content {
                    padding: 25px 20px;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">SEO Pilot</div>
                <div class="tagline">Dominate Search Results with AI-Powered SEO</div>
            </div>
            
            <div class="content">
                <div class="welcome-message">
                    Welcome aboard, ${name}! 🚀
                </div>
                
                <div class="intro-text">
                    Congratulations on joining thousands of businesses that are already transforming their online presence with SEO Pilot. You're now equipped with the most powerful AI-driven SEO platform to boost your search rankings and drive organic traffic.
                </div>
                
                <div class="features-grid">
                    <div class="feature-item">
                        <div class="feature-icon">🤖</div>
                        <div class="feature-title">AI Content Generation</div>
                        <div class="feature-desc">Automated article creation based on rich keyword analysis</div>
                    </div>
                    <div class="feature-item">
                        <div class="feature-icon">📊</div>
                        <div class="feature-title">Advanced Analytics</div>
                        <div class="feature-desc">Real-time insights and performance tracking</div>
                    </div>
                    <div class="feature-item">
                        <div class="feature-icon">🔗</div>
                        <div class="feature-title">Seamless Integrations</div>
                        <div class="feature-desc">WordPress, Shopify, and more platforms</div>
                    </div>
                    <div class="feature-item">
                        <div class="feature-icon">🎯</div>
                        <div class="feature-title">Smart Automation</div>
                        <div class="feature-desc">Schedule and publish content automatically</div>
                    </div>
                </div>
                
                <div class="cta-section">
                    <div class="cta-title">Ready to dominate search results?</div>
                    <a href="https://seopilot.in/dashboard" class="cta-button">Access Your Dashboard</a>
                </div>
                
                <div class="next-steps">
                    <h3>Your Next Steps:</h3>
                    <ul class="steps-list">
                        <li>Connect your WordPress, Shopify, or website in seconds</li>
                        <li>Let our AI analyze your content and competitors</li>
                        <li>Review your personalized SEO strategy</li>
                        <li>Start generating and publishing optimized content</li>
                        <li>Watch your organic traffic grow automatically</li>
                    </ul>
                </div>
                
                <div class="support-section">
                    Need help getting started? Our team is here to support you every step of the way.<br>
                    <a href="mailto:support@seopilot.in">Contact Support</a> | <a href="https://seopilot.in/help">Help Center</a>
                </div>
            </div>
            
            <div class="footer">
                <div>
                    © 2025 SEO Pilot. All rights reserved.<br>
                    <a href="https://seopilot.in/privacy">Privacy Policy</a> | 
                    <a href="https://seopilot.in/terms">Terms of Service</a> | 
                    <a href="https://seopilot.in/unsubscribe">Unsubscribe</a>
                </div>
                <div class="social-links">
                    <a href="#">Twitter</a>
                    <a href="#">LinkedIn</a>
                    <a href="#">Facebook</a>
                </div>
            </div>
        </div>
    </body>
    </html>
  `;
}

export function getTrialExpiryReminderMail(
  name: string,
  daysRemaining: number,
  articlesGenerated: number,
  trafficIncrease: number,
  keywordsRanked: number
): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your SEO Pilot Trial is Expiring Soon</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Arial', sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #f8fafc;
            }
            
            .container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 40px 30px;
                text-align: center;
            }
            
            .logo {
                font-size: 28px;
                font-weight: bold;
                margin-bottom: 10px;
                letter-spacing: 1px;
            }
            
            .tagline {
                font-size: 16px;
                opacity: 0.9;
                margin-bottom: 0;
            }
            
            .content {
                padding: 40px 30px;
            }
            
            .urgency-banner {
                background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
                color: white;
                padding: 20px;
                text-align: center;
                border-radius: 8px;
                margin-bottom: 30px;
                box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
            }
            
            .urgency-text {
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 8px;
            }
            
            .countdown {
                font-size: 24px;
                font-weight: bold;
                text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            }
            
            .main-message {
                font-size: 20px;
                color: #2d3748;
                margin-bottom: 20px;
                font-weight: 600;
                text-align: center;
            }
            
            .intro-text {
                font-size: 16px;
                color: #4a5568;
                margin-bottom: 30px;
                line-height: 1.7;
                text-align: center;
            }
            
            .trial-stats {
                background: #f7fafc;
                padding: 25px;
                border-radius: 8px;
                margin-bottom: 30px;
                border-left: 4px solid #667eea;
            }
            
            .trial-stats h3 {
                color: #2d3748;
                margin-bottom: 15px;
                font-size: 16px;
                text-align: center;
            }
            
            .stats-grid {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                gap: 15px;
                text-align: center;
            }
            
            .stat-item {
                background: white;
                padding: 15px;
                border-radius: 6px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
            }
            
            .stat-number {
                font-size: 24px;
                font-weight: bold;
                color: #667eea;
                display: block;
            }
            
            .stat-label {
                font-size: 12px;
                color: #718096;
                margin-top: 5px;
            }
            
            .value-proposition {
                background: #edf2f7;
                padding: 25px;
                border-radius: 8px;
                margin-bottom: 30px;
            }
            
            .value-proposition h3 {
                color: #2d3748;
                margin-bottom: 15px;
                font-size: 16px;
                text-align: center;
            }
            
            .benefits-list {
                list-style: none;
                padding: 0;
            }
            
            .benefits-list li {
                padding: 8px 0;
                color: #4a5568;
                font-size: 14px;
                position: relative;
                padding-left: 25px;
            }
            
            .benefits-list li:before {
                content: "💎";
                position: absolute;
                left: 0;
                font-size: 16px;
            }
            
            .cta-section {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px;
                text-align: center;
                border-radius: 8px;
                margin-bottom: 30px;
            }
            
            .cta-title {
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 15px;
            }
            
            .cta-button {
                display: inline-block;
                background: #ffffff;
                color: #667eea;
                padding: 15px 35px;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 600;
                font-size: 16px;
                transition: all 0.3s ease;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                margin: 0 10px 10px 0;
            }
            
            .cta-button:hover {
                background: #f7fafc;
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
            }
            
            .cta-button.secondary {
                background: transparent;
                color: white;
                border: 2px solid white;
            }
            
            .cta-button.secondary:hover {
                background: white;
                color: #667eea;
            }
            
            .pricing-highlight {
                background: #fff5f5;
                border: 2px solid #fed7d7;
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 30px;
                text-align: center;
            }
            
            .pricing-highlight .discount {
                color: #e53e3e;
                font-size: 16px;
                font-weight: 600;
                margin-bottom: 10px;
            }
            
            .pricing-highlight .offer {
                color: #2d3748;
                font-size: 14px;
            }
            
            .support-section {
                text-align: center;
                color: #718096;
                font-size: 14px;
                margin-bottom: 20px;
            }
            
            .support-section a {
                color: #667eea;
                text-decoration: none;
                font-weight: 600;
            }
            
            .footer {
                background: #2d3748;
                color: #a0aec0;
                padding: 25px 30px;
                text-align: center;
                font-size: 12px;
            }
            
            .footer a {
                color: #667eea;
                text-decoration: none;
            }
            
            .social-links {
                margin-top: 15px;
            }
            
            .social-links a {
                display: inline-block;
                margin: 0 8px;
                color: #a0aec0;
                text-decoration: none;
                font-size: 14px;
            }
            
            @media (max-width: 600px) {
                .stats-grid {
                    grid-template-columns: 1fr;
                }
                
                .container {
                    margin: 0 10px;
                }
                
                .header, .content {
                    padding: 25px 20px;
                }
                
                .cta-button {
                    display: block;
                    margin: 10px 0;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">SEO Pilot</div>
                <div class="tagline">Dominate Search Results with AI-Powered SEO</div>
            </div>
            
            <div class="content">
                <div class="urgency-banner">
                    <div class="urgency-text">⏰ Your Free Trial Expires Soon!</div>
                    <div class="countdown">${daysRemaining} Days Remaining</div>
                </div>
                
                <div class="main-message">
                    Don't let your SEO momentum stop, ${name}!
                </div>
                
                <div class="intro-text">
                    Your SEO Pilot free trial has been working hard for you. Before it expires, let's make sure you don't lose the progress you've made and continue growing your organic traffic.
                </div>
                
                <div class="trial-stats">
                    <h3>🚀 Your Trial Results So Far:</h3>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-number">${articlesGenerated}</span>
                            <div class="stat-label">Articles Generated</div>
                        </div>
                        <div class="stat-item">
                            <span class="stat-number">${trafficIncrease}%</span>
                            <div class="stat-label">Traffic Increase</div>
                        </div>
                        <div class="stat-item">
                            <span class="stat-number">${keywordsRanked}</span>
                            <div class="stat-label">Keywords Ranked</div>
                        </div>
                    </div>
                </div>
                
                <div class="value-proposition">
                    <h3>🎯 What You'll Keep With a Paid Plan:</h3>
                    <ul class="benefits-list">
                        <li>Unlimited AI-generated SEO content</li>
                        <li>Advanced keyword research and tracking</li>
                        <li>Automatic content publishing to your website</li>
                        <li>Detailed analytics and performance reports</li>
                        <li>Priority customer support</li>
                        <li>Integration with WordPress, Shopify, and more</li>
                    </ul>
                </div>
                
                <div class="pricing-highlight">
                    <div class="discount">🔥 Limited Time: 20% OFF Your First Month!</div>
                    <div class="offer">Use code TRIAL20 at checkout</div>
                </div>
                
                <div class="cta-section">
                    <div class="cta-title">Ready to continue your SEO success?</div>
                    <a href="https://seopilot.in/upgrade" class="cta-button">Upgrade Now & Save 20%</a>
                    <a href="https://seopilot.in/pricing" class="cta-button secondary">View All Plans</a>
                </div>
                
                <div class="support-section">
                    Questions about upgrading? Our team is here to help you choose the perfect plan.<br>
                    <a href="mailto:support@seopilot.in">Contact Support</a> | <a href="https://seopilot.in/help">Help Center</a> | <a href="https://seopilot.in/demo">Book a Demo</a>
                </div>
            </div>
            
            <div class="footer">
                <div>
                    © 2025 SEO Pilot. All rights reserved.<br>
                    <a href="https://seopilot.in/privacy">Privacy Policy</a> | 
                    <a href="https://seopilot.in/terms">Terms of Service</a> | 
                    <a href="https://seopilot.in/unsubscribe">Unsubscribe</a>
                </div>
                <div class="social-links">
                    <a href="#">Twitter</a>
                    <a href="#">LinkedIn</a>
                    <a href="#">Facebook</a>
                </div>
            </div>
        </div>
    </body>
    </html>
  `;
}

export function getTrialExpiredMail(
  name: string,
  articlesGenerated: number,
  trafficIncrease: number,
  keywordsRanked: number
): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your SEO Pilot Trial Has Ended</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Arial', sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #f8fafc;
            }
            
            .container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 40px 30px;
                text-align: center;
            }
            
            .logo {
                font-size: 28px;
                font-weight: bold;
                margin-bottom: 10px;
                letter-spacing: 1px;
            }
            
            .tagline {
                font-size: 16px;
                opacity: 0.9;
                margin-bottom: 0;
            }
            
            .content {
                padding: 40px 30px;
            }
            
            .expired-banner {
                background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
                color: white;
                padding: 20px;
                text-align: center;
                border-radius: 8px;
                margin-bottom: 30px;
                box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
            }
            
            .expired-text {
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 8px;
            }
            
            .expired-subtitle {
                font-size: 16px;
                opacity: 0.9;
            }
            
            .main-message {
                font-size: 20px;
                color: #2d3748;
                margin-bottom: 20px;
                font-weight: 600;
                text-align: center;
            }
            
            .intro-text {
                font-size: 16px;
                color: #4a5568;
                margin-bottom: 30px;
                line-height: 1.7;
                text-align: center;
            }
            
            .trial-results {
                background: #f7fafc;
                padding: 25px;
                border-radius: 8px;
                margin-bottom: 30px;
                border-left: 4px solid #667eea;
            }
            
            .trial-results h3 {
                color: #2d3748;
                margin-bottom: 15px;
                font-size: 16px;
                text-align: center;
            }
            
            .results-grid {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                gap: 15px;
                text-align: center;
            }
            
            .result-item {
                background: white;
                padding: 15px;
                border-radius: 6px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
            }
            
            .result-number {
                font-size: 24px;
                font-weight: bold;
                color: #667eea;
                display: block;
            }
            
            .result-label {
                font-size: 12px;
                color: #718096;
                margin-top: 5px;
            }
            
            .reactivate-benefits {
                background: #edf2f7;
                padding: 25px;
                border-radius: 8px;
                margin-bottom: 30px;
            }
            
            .reactivate-benefits h3 {
                color: #2d3748;
                margin-bottom: 15px;
                font-size: 16px;
                text-align: center;
            }
            
            .benefits-list {
                list-style: none;
                padding: 0;
            }
            
            .benefits-list li {
                padding: 8px 0;
                color: #4a5568;
                font-size: 14px;
                position: relative;
                padding-left: 25px;
            }
            
            .benefits-list li:before {
                content: "🚀";
                position: absolute;
                left: 0;
                font-size: 16px;
            }
            
            .special-offer {
                background: #fff5f5;
                border: 2px solid #fed7d7;
                padding: 25px;
                border-radius: 8px;
                margin-bottom: 30px;
                text-align: center;
            }
            
            .special-offer h3 {
                color: #e53e3e;
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 10px;
            }
            
            .special-offer .discount {
                color: #2d3748;
                font-size: 16px;
                font-weight: 600;
                margin-bottom: 10px;
            }
            
            .special-offer .offer-details {
                color: #4a5568;
                font-size: 14px;
            }
            
            .cta-section {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px;
                text-align: center;
                border-radius: 8px;
                margin-bottom: 30px;
            }
            
            .cta-title {
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 15px;
            }
            
            .cta-button {
                display: inline-block;
                background: #ffffff;
                color: #667eea;
                padding: 15px 35px;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 600;
                font-size: 16px;
                transition: all 0.3s ease;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                margin: 0 10px 10px 0;
            }
            
            .cta-button:hover {
                background: #f7fafc;
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
            }
            
            .cta-button.secondary {
                background: transparent;
                color: white;
                border: 2px solid white;
            }
            
            .cta-button.secondary:hover {
                background: white;
                color: #667eea;
            }
            
            .missed-opportunities {
                background: #fffaf0;
                border-left: 4px solid #f6ad55;
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 30px;
            }
            
            .missed-opportunities h4 {
                color: #c05621;
                margin-bottom: 10px;
                font-size: 14px;
                font-weight: 600;
            }
            
            .missed-opportunities p {
                color: #744210;
                font-size: 14px;
                line-height: 1.5;
            }
            
            .support-section {
                text-align: center;
                color: #718096;
                font-size: 14px;
                margin-bottom: 20px;
            }
            
            .support-section a {
                color: #667eea;
                text-decoration: none;
                font-weight: 600;
            }
            
            .footer {
                background: #2d3748;
                color: #a0aec0;
                padding: 25px 30px;
                text-align: center;
                font-size: 12px;
            }
            
            .footer a {
                color: #667eea;
                text-decoration: none;
            }
            
            .social-links {
                margin-top: 15px;
            }
            
            .social-links a {
                display: inline-block;
                margin: 0 8px;
                color: #a0aec0;
                text-decoration: none;
                font-size: 14px;
            }
            
            @media (max-width: 600px) {
                .results-grid {
                    grid-template-columns: 1fr;
                }
                
                .timeline-items {
                    flex-direction: column;
                    gap: 10px;
                }
                
                .container {
                    margin: 0 10px;
                }
                
                .header, .content {
                    padding: 25px 20px;
                }
                
                .cta-button {
                    display: block;
                    margin: 10px 0;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">SEO Pilot</div>
                <div class="tagline">Dominate Search Results with AI-Powered SEO</div>
            </div>
            
            <div class="content">
                <div class="expired-banner">
                    <div class="expired-text">⏰ Your Free Trial Has Ended</div>
                    <div class="expired-subtitle">But your SEO journey doesn't have to stop here!</div>
                </div>
                
                <div class="main-message">
                    ${name}, let's keep your momentum going! 🚀
                </div>
                
                <div class="intro-text">
                    Your SEO Pilot free trial may have ended, but the results you achieved show exactly what's possible when you have the right tools. Don't let this progress go to waste!
                </div>
                
                <div class="trial-results">
                    <h3>📈 What You Accomplished During Your Trial:</h3>
                    <div class="results-grid">
                        <div class="result-item">
                            <span class="result-number">${articlesGenerated}</span>
                            <div class="result-label">Articles Generated</div>
                        </div>
                        <div class="result-item">
                            <span class="result-number">${trafficIncrease}%</span>
                            <div class="result-label">Traffic Increase</div>
                        </div>
                        <div class="result-item">
                            <span class="result-number">${keywordsRanked}</span>
                            <div class="result-label">Keywords Ranked</div>
                        </div>
                    </div>
                </div>
                
                <div class="missed-opportunities">
                    <h4>⚠️ Don't Miss Out:</h4>
                    <p>Every day without SEO Pilot means missed opportunities for organic traffic, potential customers finding your competitors instead, and losing the SEO momentum you've built.</p>
                </div>
                
                <div class="special-offer">
                    <h3>🎁 Exclusive Comeback Offer!</h3>
                    <div class="discount">Get 30% OFF Your First Month</div>
                    <div class="offer-details">Use code COMEBACK30 - Limited time offer just for you!</div>
                </div>
                
                <div class="reactivate-benefits">
                    <h3>🎯 Reactivate and Get Back to Growing:</h3>
                    <ul class="benefits-list">
                        <li>Continue generating unlimited SEO-optimized content</li>
                        <li>Advanced competitor analysis and keyword tracking</li>
                        <li>Automated publishing to your website</li>
                        <li>Real-time performance analytics and insights</li>
                        <li>Priority support from our SEO experts</li>
                        <li>Integration with all major platforms</li>
                    </ul>
                </div>
                
                <div class="cta-section">
                    <div class="cta-title">Ready to reclaim your SEO success?</div>
                    <a href="https://seopilot.in/reactivate" class="cta-button">Reactivate with 30% OFF</a>
                    <a href="https://seopilot.in/pricing" class="cta-button secondary">View All Plans</a>
                </div>
                
                <div class="support-section">
                    Need help choosing the right plan? We're here to help you get back on track.<br>
                    <a href="mailto:support@seopilot.in">Contact Support</a> | <a href="https://seopilot.in/help">Help Center</a> | <a href="https://seopilot.in/demo">Schedule a Call</a>
                </div>
            </div>
            
            <div class="footer">
                <div>
                    © 2025 SEO Pilot. All rights reserved.<br>
                    <a href="https://seopilot.in/privacy">Privacy Policy</a> | 
                    <a href="https://seopilot.in/terms">Terms of Service</a> | 
                    <a href="https://seopilot.in/unsubscribe">Unsubscribe</a>
                </div>
                <div class="social-links">
                    <a href="#">Twitter</a>
                    <a href="#">LinkedIn</a>
                    <a href="#">Facebook</a>
                </div>
            </div>
        </div>
    </body>
    </html>
  `;
}

export function getUsageMilestoneMail(
  name: string,
  articlesGenerated: number,
  milestone: string = '100 articles'
): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>🎉 Milestone Achievement - SEO Pilot</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Arial', sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #f8fafc;
            }
            
            .container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 40px 30px;
                text-align: center;
            }
            
            .logo {
                font-size: 28px;
                font-weight: bold;
                margin-bottom: 10px;
                letter-spacing: 1px;
            }
            
            .tagline {
                font-size: 16px;
                opacity: 0.9;
                margin-bottom: 0;
            }
            
            .content {
                padding: 40px 30px;
            }
            
            .celebration-banner {
                background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
                color: white;
                padding: 30px;
                text-align: center;
                border-radius: 8px;
                margin-bottom: 30px;
                box-shadow: 0 4px 12px rgba(72, 187, 120, 0.3);
            }
            
            .celebration-emoji {
                font-size: 48px;
                margin-bottom: 15px;
                animation: bounce 2s infinite;
            }
            
            @keyframes bounce {
                0%, 20%, 50%, 80%, 100% {
                    transform: translateY(0);
                }
                40% {
                    transform: translateY(-10px);
                }
                60% {
                    transform: translateY(-5px);
                }
            }
            
            .milestone-text {
                font-size: 20px;
                font-weight: 600;
                margin-bottom: 8px;
            }
            
            .milestone-number {
                font-size: 36px;
                font-weight: bold;
                text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                margin-bottom: 10px;
            }
            
            .milestone-subtitle {
                font-size: 16px;
                opacity: 0.9;
            }
            
            .main-message {
                font-size: 20px;
                color: #2d3748;
                margin-bottom: 20px;
                font-weight: 600;
                text-align: center;
            }
            
            .intro-text {
                font-size: 16px;
                color: #4a5568;
                margin-bottom: 30px;
                line-height: 1.7;
                text-align: center;
            }
            
            .achievement-stats {
                background: #f7fafc;
                padding: 25px;
                border-radius: 8px;
                margin-bottom: 30px;
                border-left: 4px solid #48bb78;
            }
            
            .achievement-stats h3 {
                color: #2d3748;
                margin-bottom: 20px;
                font-size: 16px;
                text-align: center;
            }
            
            .stats-showcase {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                margin-bottom: 20px;
            }
            
            .stat-showcase {
                background: white;
                padding: 20px;
                border-radius: 8px;
                text-align: center;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
            }
            
            .stat-icon {
                font-size: 32px;
                margin-bottom: 10px;
            }
            
            .stat-value {
                font-size: 24px;
                font-weight: bold;
                color: #48bb78;
                margin-bottom: 5px;
            }
            
            .stat-description {
                font-size: 14px;
                color: #718096;
            }
            
            .impact-section {
                background: #edf2f7;
                padding: 25px;
                border-radius: 8px;
                margin-bottom: 30px;
            }
            
            .impact-section h3 {
                color: #2d3748;
                margin-bottom: 15px;
                font-size: 16px;
                text-align: center;
            }
            
            .impact-list {
                list-style: none;
                padding: 0;
            }
            
            .impact-list li {
                padding: 8px 0;
                color: #4a5568;
                font-size: 14px;
                position: relative;
                padding-left: 25px;
            }
            
            .impact-list li:before {
                content: "⭐";
                position: absolute;
                left: 0;
                font-size: 16px;
            }
            
            .next-milestone {
                background: #fff5f5;
                border: 2px solid #fed7d7;
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 30px;
                text-align: center;
            }
            
            .next-milestone h4 {
                color: #e53e3e;
                font-size: 16px;
                font-weight: 600;
                margin-bottom: 10px;
            }
            
            .next-milestone .target {
                color: #2d3748;
                font-size: 14px;
                margin-bottom: 10px;
            }
            
            .progress-bar {
                background: #e2e8f0;
                height: 8px;
                border-radius: 4px;
                overflow: hidden;
                margin-bottom: 10px;
            }
            
            .progress-fill {
                background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
                height: 100%;
                width: 50%;
                border-radius: 4px;
            }
            
            .progress-text {
                font-size: 12px;
                color: #718096;
            }
            
            .cta-section {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px;
                text-align: center;
                border-radius: 8px;
                margin-bottom: 30px;
            }
            
            .cta-title {
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 15px;
            }
            
            .cta-button {
                display: inline-block;
                background: #ffffff;
                color: #667eea;
                padding: 15px 35px;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 600;
                font-size: 16px;
                transition: all 0.3s ease;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                margin: 0 10px 10px 0;
            }
            
            .cta-button:hover {
                background: #f7fafc;
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
            }
            
            .cta-button.secondary {
                background: transparent;
                color: white;
                border: 2px solid white;
            }
            
            .cta-button.secondary:hover {
                background: white;
                color: #667eea;
            }
            
            .social-share {
                background: #f7fafc;
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 30px;
                text-align: center;
            }
            
            .social-share h4 {
                color: #2d3748;
                margin-bottom: 15px;
                font-size: 14px;
            }
            
            .share-buttons {
                display: flex;
                justify-content: center;
                gap: 15px;
            }
            
            .share-button {
                padding: 8px 16px;
                text-decoration: none;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 600;
                transition: all 0.3s ease;
            }
            
            .share-twitter {
                background: #1da1f2;
                color: white;
            }
            
            .share-linkedin {
                background: #0077b5;
                color: white;
            }
            
            .share-facebook {
                background: #1877f2;
                color: white;
            }
            
            .support-section {
                text-align: center;
                color: #718096;
                font-size: 14px;
                margin-bottom: 20px;
            }
            
            .support-section a {
                color: #667eea;
                text-decoration: none;
                font-weight: 600;
            }
            
            .footer {
                background: #2d3748;
                color: #a0aec0;
                padding: 25px 30px;
                text-align: center;
                font-size: 12px;
            }
            
            .footer a {
                color: #667eea;
                text-decoration: none;
            }
            
            .social-links {
                margin-top: 15px;
            }
            
            .social-links a {
                display: inline-block;
                margin: 0 8px;
                color: #a0aec0;
                text-decoration: none;
                font-size: 14px;
            }
            
            @media (max-width: 600px) {
                .stats-showcase {
                    grid-template-columns: 1fr;
                }
                
                .container {
                    margin: 0 10px;
                }
                
                .header, .content {
                    padding: 25px 20px;
                }
                
                .cta-button {
                    display: block;
                    margin: 10px 0;
                }
                
                .share-buttons {
                    flex-direction: column;
                    align-items: center;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">SEO Pilot</div>
                <div class="tagline">Dominate Search Results with AI-Powered SEO</div>
            </div>
            
            <div class="content">
                <div class="celebration-banner">
                    <div class="celebration-emoji">🎉</div>
                    <div class="milestone-text">Congratulations!</div>
                    <div class="milestone-number">${articlesGenerated}</div>
                    <div class="milestone-subtitle">Articles Generated and Counting!</div>
                </div>
                
                <div class="main-message">
                    Amazing work, ${name}! 🚀
                </div>
                
                <div class="intro-text">
                    You've just hit an incredible milestone! ${articlesGenerated} high-quality, SEO-optimized articles generated through SEO Pilot. This is a testament to your commitment to content excellence and SEO success.
                </div>
                
                <div class="achievement-stats">
                    <h3>📊 Your Content Creation Journey:</h3>
                    <div class="stats-showcase">
                        <div class="stat-showcase">
                            <div class="stat-icon">📝</div>
                            <div class="stat-value">${articlesGenerated}</div>
                            <div class="stat-description">Articles Created</div>
                        </div>
                        <div class="stat-showcase">
                            <div class="stat-icon">⚡</div>
                            <div class="stat-value">${Math.round(articlesGenerated * 2.5)}</div>
                            <div class="stat-description">Hours Saved</div>
                        </div>
                    </div>
                </div>
                
                <div class="impact-section">
                    <h3>🌟 The Impact You've Created:</h3>
                    <ul class="impact-list">
                        <li>Built a substantial content library that drives organic traffic</li>
                        <li>Established your authority in your industry niche</li>
                        <li>Created valuable resources for your audience</li>
                        <li>Improved your website's SEO foundation significantly</li>
                        <li>Saved countless hours that you can invest in growing your business</li>
                    </ul>
                </div>
                
                <div class="next-milestone">
                    <h4>🎯 Next Milestone: 200 Articles!</h4>
                    <div class="target">You're halfway to your next major achievement</div>
                    <div class="progress-bar">
                        <div class="progress-fill"></div>
                    </div>
                    <div class="progress-text">Keep up the momentum!</div>
                </div>
                
                <div class="social-share">
                    <h4>📢 Share Your Success:</h4>
                    <div class="share-buttons">
                        <a href="https://twitter.com/intent/tweet?text=Just%20generated%20${articlesGenerated}%20SEO-optimized%20articles%20with%20@SEOPilot!%20%F0%9F%9A%80%20%23SEO%20%23ContentMarketing" class="share-button share-twitter">Share on Twitter</a>
                        <a href="https://www.linkedin.com/sharing/share-offsite/?url=https://seopilot.in" class="share-button share-linkedin">Share on LinkedIn</a>
                        <a href="https://www.facebook.com/sharer/sharer.php?u=https://seopilot.in" class="share-button share-facebook">Share on Facebook</a>
                    </div>
                </div>
                
                <div class="cta-section">
                    <div class="cta-title">Keep the momentum going!</div>
                    <a href="https://seopilot.in/dashboard" class="cta-button">Generate More Articles</a>
                    <a href="https://seopilot.in/dashboard/analytics" class="cta-button secondary">View Your Analytics</a>
                </div>
                
                <div class="support-section">
                    Loving SEO Pilot? We'd appreciate your feedback and reviews!<br>
                    <a href="mailto:support@seopilot.in">Contact Support</a> | <a href="https://seopilot.in/help">Help Center</a> | <a href="https://seopilot.in/reviews">Leave a Review</a>
                </div>
            </div>
            
            <div class="footer">
                <div>
                    © 2025 SEO Pilot. All rights reserved.<br>
                    <a href="https://seopilot.in/privacy">Privacy Policy</a> | 
                    <a href="https://seopilot.in/terms">Terms of Service</a> | 
                    <a href="https://seopilot.in/unsubscribe">Unsubscribe</a>
                </div>
                <div class="social-links">
                    <a href="#">Twitter</a>
                    <a href="#">LinkedIn</a>
                    <a href="#">Facebook</a>
                </div>
            </div>
        </div>
    </body>
    </html>
  `;
}

export function getSuccessStoryMail(
  name: string,
  businessType: string,
  trafficIncrease: number = 300,
  timeframe: string = '6 months'
): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Success Story: ${trafficIncrease}% Traffic Increase - SEO Pilot</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Arial', sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #f8fafc;
            }
            
            .container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 40px 30px;
                text-align: center;
            }
            
            .logo {
                font-size: 28px;
                font-weight: bold;
                margin-bottom: 10px;
                letter-spacing: 1px;
            }
            
            .tagline {
                font-size: 16px;
                opacity: 0.9;
                margin-bottom: 0;
            }
            
            .content {
                padding: 40px 30px;
            }
            
            .success-banner {
                background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
                color: white;
                padding: 30px;
                text-align: center;
                border-radius: 8px;
                margin-bottom: 30px;
                box-shadow: 0 4px 12px rgba(72, 187, 120, 0.3);
            }
            
            .success-emoji {
                font-size: 48px;
                margin-bottom: 15px;
            }
            
            .success-headline {
                font-size: 22px;
                font-weight: 600;
                margin-bottom: 10px;
            }
            
            .traffic-increase {
                font-size: 42px;
                font-weight: bold;
                text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                margin-bottom: 5px;
            }
            
            .timeframe-text {
                font-size: 16px;
                opacity: 0.9;
            }
            
            .main-message {
                font-size: 20px;
                color: #2d3748;
                margin-bottom: 20px;
                font-weight: 600;
                text-align: center;
            }
            
            .intro-text {
                font-size: 16px;
                color: #4a5568;
                margin-bottom: 30px;
                line-height: 1.7;
                text-align: center;
            }
            
            .case-study {
                background: #f7fafc;
                padding: 25px;
                border-radius: 8px;
                margin-bottom: 30px;
                border-left: 4px solid #48bb78;
            }
            
            .case-study h3 {
                color: #2d3748;
                margin-bottom: 20px;
                font-size: 16px;
                text-align: center;
            }
            
            .business-profile {
                background: white;
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 20px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
            }
            
            .business-profile h4 {
                color: #2d3748;
                font-size: 14px;
                font-weight: 600;
                margin-bottom: 10px;
            }
            
            .business-details {
                font-size: 14px;
                color: #4a5568;
                line-height: 1.6;
            }
            
            .results-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
                margin-bottom: 20px;
            }
            
            .result-metric {
                background: white;
                padding: 20px;
                border-radius: 8px;
                text-align: center;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
            }
            
            .metric-icon {
                font-size: 24px;
                margin-bottom: 8px;
            }
            
            .metric-value {
                font-size: 20px;
                font-weight: bold;
                color: #48bb78;
                margin-bottom: 5px;
            }
            
            .metric-label {
                font-size: 12px;
                color: #718096;
            }
            
            .strategy-section {
                background: #edf2f7;
                padding: 25px;
                border-radius: 8px;
                margin-bottom: 30px;
            }
            
            .strategy-section h3 {
                color: #2d3748;
                margin-bottom: 15px;
                font-size: 16px;
                text-align: center;
            }
            
            .strategy-list {
                list-style: none;
                padding: 0;
            }
            
            .strategy-list li {
                padding: 8px 0;
                color: #4a5568;
                font-size: 14px;
                position: relative;
                padding-left: 25px;
            }
            
            .strategy-list li:before {
                content: "🚀";
                position: absolute;
                left: 0;
                font-size: 16px;
            }
            
            .testimonial {
                background: #fff5f5;
                border: 2px solid #fed7d7;
                padding: 25px;
                border-radius: 8px;
                margin-bottom: 30px;
                text-align: center;
                position: relative;
            }
            
            .quote-icon {
                font-size: 36px;
                color: #e53e3e;
                margin-bottom: 15px;
            }
            
            .testimonial-text {
                font-size: 16px;
                color: #2d3748;
                font-style: italic;
                line-height: 1.6;
                margin-bottom: 15px;
            }
            
            .testimonial-author {
                font-size: 14px;
                color: #718096;
                font-weight: 600;
            }
            
            .your-opportunity {
                background: #fffaf0;
                border-left: 4px solid #f6ad55;
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 30px;
            }
            
            .your-opportunity h4 {
                color: #c05621;
                margin-bottom: 10px;
                font-size: 16px;
                font-weight: 600;
            }
            
            .your-opportunity p {
                color: #744210;
                font-size: 14px;
                line-height: 1.5;
            }
            
            .cta-section {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px;
                text-align: center;
                border-radius: 8px;
                margin-bottom: 30px;
            }
            
            .cta-title {
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 15px;
            }
            
            .cta-button {
                display: inline-block;
                background: #ffffff;
                color: #667eea;
                padding: 15px 35px;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 600;
                font-size: 16px;
                transition: all 0.3s ease;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                margin: 0 10px 10px 0;
            }
            
            .cta-button:hover {
                background: #f7fafc;
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
            }
            
            .cta-button.secondary {
                background: transparent;
                color: white;
                border: 2px solid white;
            }
            
            .cta-button.secondary:hover {
                background: white;
                color: #667eea;
            }
            
            .timeline {
                background: #f7fafc;
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 30px;
            }
            
            .timeline h4 {
                color: #2d3748;
                margin-bottom: 15px;
                font-size: 14px;
                text-align: center;
                font-weight: 600;
            }
            
            .timeline-items {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .timeline-item {
                text-align: center;
                flex: 1;
            }
            
            .timeline-month {
                font-size: 12px;
                color: #718096;
                margin-bottom: 5px;
            }
            
            .timeline-value {
                font-size: 14px;
                font-weight: bold;
                color: #48bb78;
            }
            
            .support-section {
                text-align: center;
                color: #718096;
                font-size: 14px;
                margin-bottom: 20px;
            }
            
            .support-section a {
                color: #667eea;
                text-decoration: none;
                font-weight: 600;
            }
            
            .footer {
                background: #2d3748;
                color: #a0aec0;
                padding: 25px 30px;
                text-align: center;
                font-size: 12px;
            }
            
            .footer a {
                color: #667eea;
                text-decoration: none;
            }
            
            .social-links {
                margin-top: 15px;
            }
            
            .social-links a {
                display: inline-block;
                margin: 0 8px;
                color: #a0aec0;
                text-decoration: none;
                font-size: 14px;
            }
            
            @media (max-width: 600px) {
                .results-grid {
                    grid-template-columns: 1fr;
                }
                
                .timeline-items {
                    flex-direction: column;
                    gap: 10px;
                }
                
                .container {
                    margin: 0 10px;
                }
                
                .header, .content {
                    padding: 25px 20px;
                }
                
                .cta-button {
                    display: block;
                    margin: 10px 0;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">SEO Pilot</div>
                <div class="tagline">Dominate Search Results with AI-Powered SEO</div>
            </div>
            
            <div class="content">
                <div class="success-banner">
                    <div class="success-emoji">📈</div>
                    <div class="success-headline">Real Success Story</div>
                    <div class="traffic-increase">+${trafficIncrease}%</div>
                    <div class="timeframe-text">Traffic Growth in ${timeframe}</div>
                </div>
                
                <div class="main-message">
                    Here's how a ${businessType} achieved incredible results, ${name}! 🚀
                </div>
                
                <div class="intro-text">
                    We love sharing real success stories from businesses just like yours. This ${businessType} transformed their online presence using SEO Pilot, and you can achieve similar results too.
                </div>
                
                <div class="case-study">
                    <h3>📊 Case Study: ${businessType} Success</h3>
                    <div class="business-profile">
                        <h4>Business Profile:</h4>
                        <div class="business-details">
                            <strong>Industry:</strong> ${businessType}<br>
                            <strong>Challenge:</strong> Low organic traffic and poor search rankings<br>
                            <strong>Goal:</strong> Increase website traffic and generate more leads<br>
                            <strong>Timeline:</strong> ${timeframe} with SEO Pilot
                        </div>
                    </div>
                    
                    <div class="results-grid">
                        <div class="result-metric">
                            <div class="metric-icon">📈</div>
                            <div class="metric-value">+${trafficIncrease}%</div>
                            <div class="metric-label">Organic Traffic</div>
                        </div>
                        <div class="result-metric">
                            <div class="metric-icon">🎯</div>
                            <div class="metric-value">+450%</div>
                            <div class="metric-label">Lead Generation</div>
                        </div>
                        <div class="result-metric">
                            <div class="metric-icon">📊</div>
                            <div class="metric-value">+280%</div>
                            <div class="metric-label">Keyword Rankings</div>
                        </div>
                        <div class="result-metric">
                            <div class="metric-icon">💰</div>
                            <div class="metric-value">+320%</div>
                            <div class="metric-label">Revenue Growth</div>
                        </div>
                    </div>
                </div>
                
                <div class="timeline">
                    <h4>📅 Growth Timeline:</h4>
                    <div class="timeline-items">
                        <div class="timeline-item">
                            <div class="timeline-month">Month 1</div>
                            <div class="timeline-value">+45%</div>
                        </div>
                        <div class="timeline-item">
                            <div class="timeline-month">Month 3</div>
                            <div class="timeline-value">+120%</div>
                        </div>
                        <div class="timeline-item">
                            <div class="timeline-month">Month 6</div>
                            <div class="timeline-value">+${trafficIncrease}%</div>
                        </div>
                    </div>
                </div>
                
                <div class="strategy-section">
                    <h3>🎯 What They Did:</h3>
                    <ul class="strategy-list">
                        <li>Consistently generated SEO-optimized articles using SEO Pilot's AI</li>
                        <li>Focused on long-tail keywords in their industry niche</li>
                        <li>Published 3-4 high-quality articles per week</li>
                        <li>Optimized existing content based on AI recommendations</li>
                        <li>Built internal linking structure with automated suggestions</li>
                        <li>Tracked performance and adjusted strategy based on analytics</li>
                    </ul>
                </div>
                
                <div class="testimonial">
                    <div class="quote-icon">"</div>
                    <div class="testimonial-text">
                        "SEO Pilot completely transformed our online presence. The AI-generated content is so good that our audience engagement has skyrocketed. We went from page 3 to page 1 for our main keywords in just a few months!"
                    </div>
                    <div class="testimonial-author">
                        - Marketing Director, ${businessType}
                    </div>
                </div>
                
                <div class="your-opportunity">
                    <h4>🌟 Your Opportunity:</h4>
                    <p>This ${businessType} started with the same challenges you might be facing. With SEO Pilot's AI-powered content generation and strategic guidance, you can achieve similar remarkable results in your industry.</p>
                </div>
                
                <div class="cta-section">
                    <div class="cta-title">Ready to write your own success story?</div>
                    <a href="https://seopilot.in/dashboard" class="cta-button">Start Creating Content</a>
                    <a href="https://seopilot.in/case-studies" class="cta-button secondary">View More Success Stories</a>
                </div>
                
                <div class="support-section">
                    Want to discuss your specific goals? Our team is here to help you create your success strategy.<br>
                    <a href="mailto:support@seopilot.in">Contact Support</a> | <a href="https://seopilot.in/help">Help Center</a> | <a href="https://seopilot.in/strategy-call">Book Strategy Call</a>
                </div>
            </div>
            
            <div class="footer">
                <div>
                    © 2025 SEO Pilot. All rights reserved.<br>
                    <a href="https://seopilot.in/privacy">Privacy Policy</a> | 
                    <a href="https://seopilot.in/terms">Terms of Service</a> | 
                    <a href="https://seopilot.in/unsubscribe">Unsubscribe</a>
                </div>
                <div class="social-links">
                    <a href="#">Twitter</a>
                    <a href="#">LinkedIn</a>
                    <a href="#">Facebook</a>
                </div>
            </div>
        </div>
    </body>
    </html>
  `;
}

export function getInviteMail(name: string, inviteLink: string, brandName: string): string {
  const message = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome ${name}!</h2>
        <p>You have been invited to join our platform.</p>
        <p>Please click the button below to complete your registration:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteLink}" 
             style="background-color: #4CAF50; 
                    color: white; 
                    padding: 14px 25px; 
                    text-decoration: none; 
                    border-radius: 4px;
                    display: inline-block;">
            Complete Registration
          </a>
        </div>
        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p>${inviteLink}</p>
        <p>This invitation link will expire in 24 hours.</p>
        <p>Thank you!</p>
        <p>Best regards,<br>${brandName}</p>
      </div>
    `;

  return message;
}

export function getReminderMail(
  name: string,
  courseTitle: string,
  deadline: Date,
  reminderType: string,
  brandName: string
): string {
  let reminderMessage = '';

  switch (reminderType) {
    case 'FIRST_REMINDER':
      reminderMessage = 'This is a friendly reminder that your course assignment is due soon.';
      break;
    case 'SECOND_REMINDER':
      reminderMessage =
        'Your course deadline is approaching. Please make sure to complete your assignment on time.';
      break;
    case 'FINAL_REMINDER':
      reminderMessage =
        'Urgent: Your course deadline is very close. Please complete your assignment as soon as possible.';
      break;
    default:
      reminderMessage = 'This is a reminder about your course assignment.';
  }

  const message = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hello ${name}!</h2>
        <p>${reminderMessage}</p>
        <p>Course: <strong>${courseTitle}</strong></p>
        <p>Deadline: <strong>${deadline}</strong></p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/my-courses" 
             style="background-color: #4CAF50; 
                    color: white; 
                    padding: 14px 25px; 
                    text-decoration: none; 
                    border-radius: 4px;
                    display: inline-block;">
            Go to My Courses
          </a>
        </div>
        <p>Thank you for your attention to this matter.</p>
        <p>Best regards,<br>${brandName}</p>
      </div>
    `;

  return message;
}

export function getForgetPasswordMail(fullName: string, otp: string, brandName: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #f9fafb; border-radius: 8px;">
      <div style="text-align: center; padding-bottom: 20px;">
        <h2 style="color: #4f46e5; margin-bottom: 10px;">Password Reset Request</h2>
        <p style="font-size: 16px; color: #6b7280;">Securely reset your account access</p>
      </div>
      <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <p style="margin-top: 0;">Hi ${fullName},</p>
        <p>We received a request to reset your password for <strong>${brandName}</strong>. Please use the following One-Time Password (OTP) to proceed:</p>
        
        <div style="background-color: #f3f4f6; padding: 25px; border-radius: 8px; margin: 25px 0; text-align: center; border: 2px dashed #d1d5db;">
          <p style="margin: 0; color: #374151; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Your OTP Code</p>
          <p style="margin: 10px 0 0; font-size: 36px; font-weight: bold; color: #111827; letter-spacing: 5px;">${otp}</p>
        </div>

        <p style="font-size: 14px; color: #6b7280; line-height: 1.5;">
          If you did not request this change, you can safely ignore this email. Your password will remain unchanged.
        </p>
      </div>
      <div style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 25px;">
        <p>© ${new Date().getFullYear()} ${brandName}. All rights reserved.</p>
      </div>
    </div>
  `;
}

// make a template for invite pls
export function getInviteMailText(name: string, inviteLink: string, brandName: string): string {
  const message = `
        Welcome ${name}
        You have been invited to join our platform.
        Please click the button below to complete your registration:
       
        ${inviteLink}
  
        Complete Registration
        
        If the button doesn't work, you can copy and paste this link into your browser:
        ${inviteLink}
        This invitation link will expire in 24 hours.
  
        Thank you!
        Best regards,
        ${brandName}
    `;

  return message;
}

export function getReminderMailText(
  name: string,
  courseTitle: string,
  deadline: Date,
  reminderType: string,
  brandName: string
): string {
  let reminderMessage = '';

  switch (reminderType) {
    case 'initial':
      reminderMessage =
        'This is a friendly reminder about your upcoming course assignment deadline.';
      break;
    case 'followup':
      reminderMessage =
        'This is a follow-up reminder about your course assignment that is due soon.';
      break;
    case 'urgent':
      reminderMessage =
        'Urgent: Your course deadline is very close. Please complete your assignment as soon as possible.';
      break;
    default:
      reminderMessage = 'This is a reminder about your course assignment.';
  }

  const message = `
        Hello ${name}!
        
        ${reminderMessage}
        
        Course: ${courseTitle}
        Deadline: ${deadline}
        
        Please visit the My Courses section to complete your assignment:
        ${process.env.FRONTEND_URL}/my-courses
        
        Thank you for your attention to this matter.
        
        Best regards,
        ${brandName}
    `;

  return message;
}

export function getForgetPasswordMailText(
  fullName: string,
  otp: string,
  brandName: string
): string {
  return `
      Password Reset Request
      Hi ${fullName}
      We received a request to reset your password. Your One-Time Password (OTP) is:
      ${otp}
      Please enter this OTP in the application to proceed with resetting your password.
      If you did not request a password reset, please ignore this email.
      Thank you!
      Best regards,<br>${brandName}
    `;
}

export function getOtpMailText(name: string, otp: string, brandName: string): string {
  return `
    Hello ${name},
    Your verification code is: ${otp}.
    This code will expire in 10 minutes.
    If you didn't request this code, please ignore this email.
    Best regards,
    ${brandName}.
  `;
}

export function getPropertyEmailVerificationMail(
  email: string,
  verificationLink: string,
  brandName: string
): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">Property Email Verification</h2>
      <p>Hello,</p>
      <p>You have been added as a posting email for a property on our platform.</p>
      <p>Please verify your email address by clicking the button below:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationLink}" 
           style="background-color: #4CAF50; 
                  color: white; 
                  padding: 14px 25px; 
                  text-decoration: none; 
                  border-radius: 4px;
                  display: inline-block;">
          Verify Email Address
        </a>
      </div>
      <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #666;">${verificationLink}</p>
      <p>This verification link will expire in 24 hours.</p>
      <p>If you didn't expect this email, please ignore it.</p>
      <p>Best regards,<br>${brandName}</p>
      <div style="color: #666; font-size: 12px; margin-top: 20px; border-top: 1px solid #eee; padding-top: 20px;">
        <p>This is an automated message, please do not reply to this email.</p>
      </div>
    </div>
  `;
}

/**
 * @deprecated SECURITY: This function has been removed because it sent plaintext
 * passwords in emails. Use password reset links instead of sending passwords.
 * Removed as part of security audit fix CRIT-011.
 */

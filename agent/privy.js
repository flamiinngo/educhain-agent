import dotenv from "dotenv";
dotenv.config();

import { PrivyClient } from "@privy-io/server-auth";

const privy = new PrivyClient(
  process.env.PRIVY_APP_ID,
  process.env.PRIVY_APP_SECRET
);

// ─── GET OR CREATE WALLET FOR A STUDENT ───
// Given an email or phone, returns a real embedded wallet address.
// If the user doesn't exist in Privy yet, creates them automatically.
// Same email always returns the same wallet — deterministic via Privy.
export async function getOrCreateStudentWallet(contact) {
  try {
    // Try to find existing user first
    let user = null;

    const isEmail = contact.includes("@");

    try {
      if (isEmail) {
        user = await privy.getUserByEmail(contact);
      } else {
        user = await privy.getUserByPhone(contact);
      }
      console.log(`[PRIVY] Found existing user: ${contact}`);
    } catch (e) {
      // User doesn't exist yet — create them
      console.log(`[PRIVY] Creating new user: ${contact}`);
    }

    if (!user) {
      // Create user with embedded wallet
      if (isEmail) {
        user = await privy.importUser({
          linkedAccounts: [
            {
              type: "email",
              address: contact
            }
          ],
          createEmbeddedWallet: true
        });
      } else {
        user = await privy.importUser({
          linkedAccounts: [
            {
              type: "phone",
              number: contact
            }
          ],
          createEmbeddedWallet: true
        });
      }
      console.log(`[PRIVY] Created user: ${contact} → ${user.id}`);
    }

    // Get the embedded wallet address
    const embeddedWallet = user.linkedAccounts?.find(
      a => a.type === "wallet" && a.walletClientType === "privy"
    );

    if (embeddedWallet?.address) {
      console.log(`[PRIVY] Wallet for ${contact}: ${embeddedWallet.address}`);
      return {
        success: true,
        address: embeddedWallet.address,
        userId: user.id,
        isNew: false
      };
    }

    // Wallet not yet created — request creation
    const walletResult = await privy.createWallet({ userId: user.id });
    console.log(`[PRIVY] Created wallet for ${contact}: ${walletResult.address}`);

    return {
      success: true,
      address: walletResult.address,
      userId: user.id,
      isNew: true
    };

  } catch (err) {
    console.log(`[PRIVY] Error for ${contact}: ${err.message}`);

    // Fallback — deterministic wallet from email hash so nothing breaks
    const { ethers } = await import("ethers");
    const hash = ethers.keccak256(ethers.toUtf8Bytes(contact));
    const fallbackWallet = new ethers.Wallet(hash);
    console.log(`[PRIVY] Fallback wallet for ${contact}: ${fallbackWallet.address}`);

    return {
      success: false,
      address: fallbackWallet.address,
      userId: null,
      isNew: false,
      fallback: true
    };
  }
}

// ─── VERIFY PRIVY TOKEN (for frontend auth) ───
export async function verifyPrivyToken(token) {
  try {
    const claims = await privy.verifyAuthToken(token);
    return { valid: true, userId: claims.userId };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

export { privy };

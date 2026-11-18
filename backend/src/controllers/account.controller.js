import bcrypt from "bcrypt";
import { prisma } from "../db.js";

export async function deleteMyAccount(req, res) {
  try {
    const password = req.body?.password;
    const confirmation = req.body?.confirmation;
    if (typeof password !== "string" || !password || confirmation !== "DELETE") {
      return res.status(400).json({ message: 'Enter your password and type DELETE to confirm account deletion.' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: "The password is incorrect." });
    }

    // Deleting the user cascades through sessions and dependent records according to the current schema.
    // Financial records may need a separate retention/anonymization policy before production launch.
    await prisma.user.delete({ where: { id: user.id } });
    return res.json({ message: "Your NexaCore account has been deleted." });
  } catch (error) {
    console.error("Account deletion failed:", error.message);
    return res.status(500).json({ message: "The account could not be deleted. Please try again." });
  }
}

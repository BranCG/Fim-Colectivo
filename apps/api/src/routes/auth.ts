import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma';
import { generateTokens } from '../middleware/auth';

const router = Router();

// ─── REGISTRO PASAJERO ────────────────────────────────────────────────────
router.post('/passenger/register', async (req: Request, res: Response) => {
  try {
    const { email, phone, name, password, rut, birthDate, address, idFrontUrl, idBackUrl, selfieUrl } = req.body;

    if (!email || !phone || !name || !password) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    // Verificar si ya existe
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
    });
    if (existing) {
      return res.status(409).json({ error: 'Email o teléfono ya registrado' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        phone,
        name,
        passwordHash,
        rut,
        birthDate: birthDate ? new Date(birthDate) : undefined,
        address,
        idFrontUrl,
        idBackUrl,
        selfieUrl,
        role: 'passenger',
      },
    });

    const tokens = generateTokens({
      id: user.id,
      role: 'passenger',
      email: user.email,
    });

    return res.status(201).json({
      message: 'Registro exitoso',
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      ...tokens,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ─── LOGIN PASAJERO ───────────────────────────────────────────────────────
router.post('/passenger/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const tokens = generateTokens({
      id: user.id,
      role: user.role as 'passenger' | 'driver' | 'admin',
      email: user.email,
    });

    return res.json({
      message: 'Login exitoso',
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      ...tokens,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ─── REGISTRO CONDUCTOR ───────────────────────────────────────────────────
router.post('/driver/register', async (req: Request, res: Response) => {
  try {
    const {
      email, phone, name, password, rut, birthDate, address,
      licenseNumber, vehicleBrand, vehicleModel, vehicleYear, vehiclePlate, tagNumber,
      idFrontUrl, idBackUrl, selfieUrl, licenseUrl, vehiclePhotoUrl,
      membershipPlan,
      bankName, bankAccountType, bankAccountNumber, bankAccountName, bankAccountRut, bankAccountEmail,
    } = req.body;

    const required = [email, phone, name, password, rut, birthDate, address,
      licenseNumber, vehicleBrand, vehicleModel, vehicleYear, vehiclePlate, tagNumber,
      idFrontUrl, idBackUrl, selfieUrl, licenseUrl, vehiclePhotoUrl, membershipPlan,
      bankName, bankAccountType, bankAccountNumber, bankAccountName, bankAccountRut, bankAccountEmail];

    if (required.some(v => !v)) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    if (name.trim().split(' ').length < 3) {
      return res.status(400).json({ error: 'Debes ingresar nombres y ambos apellidos' });
    }

    if (Number(vehicleYear) < 2007) {
      return res.status(400).json({ error: 'Solo aceptamos vehículos del año 2007 en adelante' });
    }

    // Verificar duplicados
    const existing = await prisma.driver.findFirst({
      where: { OR: [{ email }, { phone }, { rut }, { vehiclePlate }] },
    });
    if (existing) {
      return res.status(409).json({ error: 'Email, teléfono, RUT o patente ya están registrados en el sistema' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const driver = await prisma.driver.create({
      data: {
        email, phone, name, passwordHash,
        rut, birthDate: new Date(birthDate), address,
        idFrontUrl, idBackUrl, selfieUrl,
        licenseNumber, licenseUrl,
        vehicleBrand, vehicleModel,
        vehicleYear: Number(vehicleYear),
        vehiclePlate, vehiclePhotoUrl, tagNumber,
        membershipPlan,
        membershipGoal: membershipPlan === 'PROGRESSIVE' ? 120000 : 100000,
        bankName, bankAccountType, bankAccountNumber, bankAccountName, bankAccountRut, bankAccountEmail,
        status: 'pending',
      },
    });

    const tokens = generateTokens({
      id: driver.id,
      role: 'driver',
      email: driver.email,
    });

    return res.status(201).json({
      message: 'Solicitud enviada. Tu información está siendo revisada por nuestro equipo.',
      driver: {
        id: driver.id,
        name: driver.name,
        email: driver.email,
        status: driver.status,
      },
      ...tokens,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ─── LOGIN CONDUCTOR ──────────────────────────────────────────────────────
router.post('/driver/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const driver = await prisma.driver.findUnique({ where: { email } });
    if (!driver) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const valid = await bcrypt.compare(password, driver.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const tokens = generateTokens({
      id: driver.id,
      role: 'driver',
      email: driver.email,
    });

    return res.json({
      message: 'Login exitoso',
      driver: {
        id: driver.id,
        name: driver.name,
        email: driver.email,
        status: driver.status,
        membershipPaid: driver.membershipPaid,
        walletBalance: driver.walletBalance,
      },
      ...tokens,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ─── LOGIN ADMIN ──────────────────────────────────────────────────────────
router.post('/admin/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== 'admin') {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const tokens = generateTokens({ id: user.id, role: 'admin', email: user.email });

    return res.json({
      message: 'Login admin exitoso',
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      ...tokens,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;

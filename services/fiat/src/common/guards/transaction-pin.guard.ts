import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  ForbiddenException,
} from "@nestjs/common";
import axios from "axios";

/** Validate against the auth service before any wallet debit. */
@Injectable()
export class TransactionPinGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    if (!/^\d{6}$/.test(request.body?.pin ?? "")) {
      throw new ForbiddenException("Enter your 6-digit transaction PIN");
    }
    const authUrl = process.env.AUTH_SERVICE_URL ?? "http://localhost:3001";
    try {
      const { data } = await axios.post(
        `${authUrl.replace(/\/$/, "")}/api/v1/auth/pin/verify`,
        { pin: request.body.pin },
        {
          headers: { Authorization: request.headers.authorization },
          timeout: 10000,
        },
      );
      if (data.data?.verified !== true)
        throw new ForbiddenException("Incorrect PIN");
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      if (
        axios.isAxiosError(error) &&
        [401, 403].includes(error.response?.status ?? 0)
      ) {
        throw new ForbiddenException(
          error.response?.data?.message ?? "PIN verification failed",
        );
      }
      throw new ServiceUnavailableException(
        "Unable to verify PIN. Please try again.",
      );
    }
  }
}

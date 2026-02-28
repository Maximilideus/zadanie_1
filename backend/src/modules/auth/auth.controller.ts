import { FastifyInstance, FastifyRequest } from "fastify"
import { loginSchema } from "./auth.schema"
import { login } from "./auth.service"

export async function loginHandler(this: FastifyInstance, request: FastifyRequest) {
  const { email, password } = loginSchema.parse(request.body)

  const user = await login(email, password)

  const token = this.jwt.sign({ userId: user.id, role: user.role })

  return { token }
}

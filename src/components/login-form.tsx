"use client"

import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import Image from "next/image"
import { login } from "@/app/login/actions"
import LoginSubmitButton from "@/app/login/LoginSubmitButton"
import { AlertCircle } from "lucide-react"

interface LoginFormProps extends React.ComponentProps<"div"> {
  errorMessage?: string | null
}

export function LoginForm({
  className,
  errorMessage,
  ...props
}: LoginFormProps) {
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <div className="flex items-center justify-center rounded-md">
            <Image src="/logo.png" alt="Peregrine LMS Logo" width={45} height={45} />
          </div>
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>
            Login with your email address and password to access your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={login}>
            <FieldGroup>

              {errorMessage ? (
                <div
                  role="alert"
                  className="flex flex-inline gap-2 items-center border border-red-200 rounded-lg bg-red-50 p-2 text-sm font-medium text-red-800"
                >
                  <AlertCircle className="inline h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  {errorMessage}
                </div>
              ) : null}

              <Field>
                <label htmlFor="email">Email</label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="learner@gmail.com"
                  required
                />
              </Field>
              <Field>
                <label htmlFor="password">Password</label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                />
              </Field>
              <Field>
                <LoginSubmitButton />
              </Field>

            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  )
}
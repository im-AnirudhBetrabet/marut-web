
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function checkEmailAuthorization(email) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}/api/v1/auth/check-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: email.trim() }),
    });
  } catch {
    throw new Error(
      "Unable to connect to MARUT Admin. Please try again."
    );
  }

  let data;

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (response.status === 200 && data.authorized === true) {
    return data;
  }

  if (response.status === 403) {
    throw new Error(
      data.error ||
        "This account is not authorized to access MARUT Admin"
    );
  }

  throw new Error(
    data.error || "Something went wrong. Please try again."
  );
}

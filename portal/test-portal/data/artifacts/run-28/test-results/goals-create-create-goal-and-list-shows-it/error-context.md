# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - heading "Texas TEKS Program Manager" [level=1] [ref=e5]
    - navigation [ref=e6]:
      - link "Dashboard" [ref=e7] [cursor=pointer]:
        - /url: /
      - link "Students" [ref=e8] [cursor=pointer]:
        - /url: /students
      - link "Login" [ref=e9] [cursor=pointer]:
        - /url: /login
  - main [ref=e10]:
    - generic [ref=e12]:
      - heading "Staff Login" [level=2] [ref=e13]
      - generic [ref=e14]:
        - generic [ref=e15]:
          - text: Username
          - textbox "Username" [ref=e16]
        - generic [ref=e17]:
          - text: Password
          - textbox "Password" [ref=e18]
        - button "Sign In" [disabled] [ref=e19]
```
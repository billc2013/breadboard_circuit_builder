# Wall Follower Robot
# Drives forward until detecting a wall within 15cm,
# then backs up, turns, and continues forward.
#
# Hardware:
#   - US-100 Ultrasonic Distance Sensor
#   - TB6612 Dual Motor Driver
#   - Two DC motors (left and right)
#
# Circuit Explorer compatible annotations below:

from machine import Pin, PWM
from time import sleep, sleep_us, ticks_us, ticks_diff

# === US-100 Ultrasonic Distance Sensor ===
# Trigger/Echo mode (jumper on back removed)
trig = Pin(14, Pin.OUT)   # us100-ultrasonic:trig
echo = Pin(15, Pin.IN)    # us100-ultrasonic:echo

# === TB6612 Motor Driver ===
# Motor A = Left motor
ain1 = Pin(2, Pin.OUT)    # tb6612-motor-driver:ain1
ain2 = Pin(3, Pin.OUT)    # tb6612-motor-driver:ain2
pwma = PWM(Pin(4))        # tb6612-motor-driver:pwma

# Motor B = Right motor
bin1 = Pin(5, Pin.OUT)    # tb6612-motor-driver:bin1
bin2 = Pin(6, Pin.OUT)    # tb6612-motor-driver:bin2
pwmb = PWM(Pin(7))        # tb6612-motor-driver:pwmb

# Standby pin - must be HIGH for motors to run
stby = Pin(8, Pin.OUT)    # tb6612-motor-driver:stby

# === Configuration ===
WALL_THRESHOLD_CM = 15    # Distance to trigger backup
MOTOR_SPEED = 40000       # PWM duty cycle (0-65535)
TURN_TIME = 0.5           # Seconds to turn
BACKUP_TIME = 0.3         # Seconds to backup

# === Setup ===
pwma.freq(1000)
pwmb.freq(1000)
stby.value(1)  # Enable motor driver


def measure_distance():
    """
    Measure distance using US-100 in Trigger/Echo mode.
    Returns distance in centimeters.
    """
    # Send 10us trigger pulse
    trig.value(0)
    sleep_us(2)
    trig.value(1)
    sleep_us(10)
    trig.value(0)

    # Wait for echo to go high (start of pulse)
    timeout = 30000  # 30ms timeout
    start_wait = ticks_us()
    while echo.value() == 0:
        if ticks_diff(ticks_us(), start_wait) > timeout:
            return -1  # Timeout - no echo received

    # Measure echo pulse duration
    pulse_start = ticks_us()
    while echo.value() == 1:
        if ticks_diff(ticks_us(), pulse_start) > timeout:
            return -1  # Timeout - echo too long
    pulse_end = ticks_us()

    # Calculate distance: time (us) / 58 = distance (cm)
    pulse_duration = ticks_diff(pulse_end, pulse_start)
    distance_cm = pulse_duration / 58

    return distance_cm


def motor_forward(speed=MOTOR_SPEED):
    """Drive both motors forward."""
    # Motor A forward
    ain1.value(1)
    ain2.value(0)
    pwma.duty_u16(speed)

    # Motor B forward
    bin1.value(1)
    bin2.value(0)
    pwmb.duty_u16(speed)


def motor_backward(speed=MOTOR_SPEED):
    """Drive both motors backward."""
    # Motor A backward
    ain1.value(0)
    ain2.value(1)
    pwma.duty_u16(speed)

    # Motor B backward
    bin1.value(0)
    bin2.value(1)
    pwmb.duty_u16(speed)


def motor_turn_right(speed=MOTOR_SPEED):
    """Turn right: left motor forward, right motor backward."""
    # Motor A (left) forward
    ain1.value(1)
    ain2.value(0)
    pwma.duty_u16(speed)

    # Motor B (right) backward
    bin1.value(0)
    bin2.value(1)
    pwmb.duty_u16(speed)


def motor_turn_left(speed=MOTOR_SPEED):
    """Turn left: left motor backward, right motor forward."""
    # Motor A (left) backward
    ain1.value(0)
    ain2.value(1)
    pwma.duty_u16(speed)

    # Motor B (right) forward
    bin1.value(1)
    bin2.value(0)
    pwmb.duty_u16(speed)


def motor_stop():
    """Stop both motors (coast)."""
    ain1.value(0)
    ain2.value(0)
    bin1.value(0)
    bin2.value(0)
    pwma.duty_u16(0)
    pwmb.duty_u16(0)


def motor_brake():
    """Brake both motors (active stop)."""
    ain1.value(1)
    ain2.value(1)
    bin1.value(1)
    bin2.value(1)
    pwma.duty_u16(MOTOR_SPEED)
    pwmb.duty_u16(MOTOR_SPEED)


# === Main Loop ===
print("Wall Follower Robot Starting...")
print(f"Wall threshold: {WALL_THRESHOLD_CM} cm")

try:
    while True:
        # Measure distance to wall
        distance = measure_distance()

        if distance < 0:
            # Sensor error - stop and retry
            print("Sensor error - stopping")
            motor_stop()
            sleep(0.1)
            continue

        print(f"Distance: {distance:.1f} cm")

        if distance < WALL_THRESHOLD_CM:
            # Wall detected! Backup and turn
            print("Wall detected! Backing up...")
            motor_backward()
            sleep(BACKUP_TIME)

            print("Turning right...")
            motor_turn_right()
            sleep(TURN_TIME)

            motor_stop()
            sleep(0.1)
        else:
            # No wall - drive forward
            motor_forward()

        sleep(0.05)  # Small delay between measurements

except KeyboardInterrupt:
    print("Stopping...")
    motor_stop()
    stby.value(0)  # Disable motor driver
    print("Done.")
